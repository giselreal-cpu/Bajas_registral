import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual, getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura } from "@/lib/facturas";
import { obtenerCajaPesosId } from "@/lib/cajaPesos";
import { parseCsv, csvRowsToObjects } from "@/lib/csvParse";

interface FilaResultado {
  fila: number;
  ok: boolean;
  error?: string;
  resumen?: string;
}

const SI = new Set(["si", "sí", "yes", "true", "1"]);

function parseFecha(valor: string): string | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// POST /api/administracion/libro-import
// body: { csv: string; dryRun: boolean }
// Importación masiva de movimientos (por caso o generales) a partir de
// la plantilla de /api/administracion/libro-import/plantilla. Con
// dryRun=true solo valida y arma un resumen fila por fila, sin escribir
// nada — la UI muestra esa vista previa antes de dejar confirmar.
export async function POST(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }

  const body = await request.json();
  const { csv, dryRun } = body as { csv: string; dryRun: boolean };
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "Falta el archivo CSV." }, { status: 400 });
  }

  const supabase = createClient();
  const usuarioActualId = await getUsuarioActualId();

  const objetos = csvRowsToObjects(parseCsv(csv));
  if (objetos.length === 0) {
    return NextResponse.json({ error: "El archivo no tiene filas para importar." }, { status: 400 });
  }
  if (objetos.length > 500) {
    return NextResponse.json(
      { error: "Máximo 500 filas por importación — dividí el archivo en partes más chicas." },
      { status: 400 }
    );
  }

  const [{ data: conceptos }, { data: cajas }, { data: cuentas }, { data: cierres }] = await Promise.all([
    supabase.from("conceptos_movimiento").select("*"),
    supabase.from("cajas").select("id, nombre"),
    supabase.from("cuentas_contables").select("id, codigo").eq("imputable", true),
    supabase.from("cierres_mensuales").select("mes")
  ]);
  const mesesCerrados = new Set((cierres ?? []).map((c) => c.mes));

  const numerosSiniestro = Array.from(
    new Set(objetos.map((o) => o.numero_siniestro?.trim()).filter((v): v is string => !!v))
  );
  const { data: casosEncontrados } =
    numerosSiniestro.length > 0
      ? await supabase
          .from("casos")
          .select("id, numero_siniestro, aseguradora_id, desarmadero_id")
          .in("numero_siniestro", numerosSiniestro)
      : { data: [] as { id: string; numero_siniestro: string; aseguradora_id: string; desarmadero_id: string | null }[] };

  const casoPorSiniestro = new Map((casosEncontrados ?? []).map((c) => [c.numero_siniestro, c]));
  const conceptoPorNombre = new Map((conceptos ?? []).map((c) => [c.nombre.toLowerCase(), c]));
  const cajaPorNombre = new Map((cajas ?? []).map((c) => [c.nombre.toLowerCase(), c]));
  const cuentaPorCodigo = new Map((cuentas ?? []).map((c) => [c.codigo.toLowerCase(), c]));

  const cajaPesosId = await obtenerCajaPesosId(supabase);

  const resultados: FilaResultado[] = [];
  let creados = 0;

  for (let i = 0; i < objetos.length; i++) {
    const fila = i + 2; // +1 por índice 0, +1 por la fila de encabezado
    const o = objetos[i];
    const tipoRegistro = o.tipo_registro?.trim().toLowerCase();
    const fecha = parseFecha(o.fecha?.trim() ?? "");
    const monto = Number(o.monto?.trim().replace(",", "."));

    if (tipoRegistro !== "caso" && tipoRegistro !== "general") {
      resultados.push({ fila, ok: false, error: `tipo_registro debe ser "caso" o "general" (vino "${o.tipo_registro}").` });
      continue;
    }
    if (!fecha) {
      resultados.push({ fila, ok: false, error: `Fecha inválida: "${o.fecha}" (usar AAAA-MM-DD o DD/MM/AAAA).` });
      continue;
    }
    if (mesesCerrados.has(fecha.slice(0, 7))) {
      resultados.push({ fila, ok: false, error: `El período de "${fecha}" ya está cerrado.` });
      continue;
    }
    if (!monto || monto <= 0) {
      resultados.push({ fila, ok: false, error: `Monto inválido: "${o.monto}".` });
      continue;
    }

    const cajaNombre = o.caja?.trim();
    const cajaElegida = cajaNombre ? cajaPorNombre.get(cajaNombre.toLowerCase()) : undefined;
    if (cajaNombre && !cajaElegida) {
      resultados.push({ fila, ok: false, error: `No existe la caja "${cajaNombre}".` });
      continue;
    }
    const cuentaCodigo = o.cuenta_contable?.trim();
    const cuentaElegida = cuentaCodigo ? cuentaPorCodigo.get(cuentaCodigo.toLowerCase()) : undefined;
    if (cuentaCodigo && !cuentaElegida) {
      resultados.push({ fila, ok: false, error: `No existe la cuenta contable "${cuentaCodigo}".` });
      continue;
    }
    const marcado = SI.has((o.pagado_o_cobrado ?? "").trim().toLowerCase());

    if (tipoRegistro === "general") {
      const tipoGeneral = o.tipo_general?.trim().toLowerCase();
      if (tipoGeneral !== "ingreso" && tipoGeneral !== "egreso") {
        resultados.push({ fila, ok: false, error: `tipo_general debe ser "ingreso" o "egreso" (vino "${o.tipo_general}").` });
        continue;
      }
      if (!o.descripcion?.trim()) {
        resultados.push({ fila, ok: false, error: "Falta la descripción." });
        continue;
      }

      if (!dryRun) {
        const { error } = await supabase.from("movimientos_generales").insert({
          fecha,
          descripcion: o.descripcion.trim(),
          tipo: tipoGeneral,
          monto,
          caja_id: cajaElegida?.id ?? null,
          cuenta_contable_id: cuentaElegida?.id ?? null,
          creado_por: usuarioActualId
        });
        if (error) {
          resultados.push({ fila, ok: false, error: error.message });
          continue;
        }
        creados++;
      }

      resultados.push({
        fila,
        ok: true,
        resumen: `General · ${tipoGeneral} · ${o.descripcion.trim()} · $${monto}`
      });
      continue;
    }

    // tipoRegistro === "caso"
    const numeroSiniestro = o.numero_siniestro?.trim();
    if (!numeroSiniestro) {
      resultados.push({ fila, ok: false, error: "Falta el número de siniestro." });
      continue;
    }
    const caso = casoPorSiniestro.get(numeroSiniestro);
    if (!caso) {
      resultados.push({ fila, ok: false, error: `No se encontró ningún caso con siniestro "${numeroSiniestro}".` });
      continue;
    }
    const conceptoNombre = o.concepto?.trim();
    const concepto = conceptoNombre ? conceptoPorNombre.get(conceptoNombre.toLowerCase()) : undefined;
    if (!conceptoNombre || !concepto) {
      resultados.push({ fila, ok: false, error: `No existe el concepto "${conceptoNombre}".` });
      continue;
    }

    const cuentaFinal = cuentaElegida?.id ?? concepto.cuenta_contable_id ?? null;
    const receptor = (o.receptor?.trim().toLowerCase() || "compania") as "compania" | "desarmadero";
    if (receptor !== "compania" && receptor !== "desarmadero") {
      resultados.push({ fila, ok: false, error: `receptor debe ser "compania" o "desarmadero" (vino "${o.receptor}").` });
      continue;
    }
    if (concepto.tipo === "ingreso" && marcado && receptor === "desarmadero" && !caso.desarmadero_id) {
      resultados.push({ fila, ok: false, error: "El caso no tiene desarmadero asignado, no se puede facturar a esa parte." });
      continue;
    }

    if (dryRun) {
      resultados.push({
        fila,
        ok: true,
        resumen:
          concepto.tipo === "egreso"
            ? `Caso ${numeroSiniestro} · ${concepto.nombre} (egreso) · $${monto}${marcado ? " · pagado" : " · pendiente de pago"}`
            : `Caso ${numeroSiniestro} · ${concepto.nombre} (ingreso) · $${monto}${marcado ? ` · cobrado (${receptor})` : " · sin cobrar todavía"}`
      });
      continue;
    }

    const cajaParaPagadoOCobrado = cajaElegida?.id ?? cajaPesosId;

    const { data: movimiento, error: errorMov } = await supabase
      .from("movimientos_caso")
      .insert({
        caso_id: caso.id,
        concepto_id: concepto.id,
        monto,
        fecha,
        observacion: o.observacion?.trim() || null,
        pagado: concepto.tipo === "egreso" ? marcado : false,
        caja_id: concepto.tipo === "egreso" ? (marcado ? cajaParaPagadoOCobrado : cajaElegida?.id ?? null) : null,
        cuenta_contable_id: cuentaFinal,
        aprobado: true,
        creado_por: usuarioActualId
      })
      .select("id")
      .single();

    if (errorMov || !movimiento) {
      resultados.push({ fila, ok: false, error: errorMov?.message ?? "No se pudo crear el movimiento." });
      continue;
    }

    let resumen = `Caso ${numeroSiniestro} · ${concepto.nombre} (${concepto.tipo}) · $${monto}`;

    if (concepto.tipo === "ingreso" && marcado) {
      const receptorId = receptor === "compania" ? caso.aseguradora_id : caso.desarmadero_id;
      const { data: factura, error: errorFactura } = await supabase
        .from("facturas")
        .insert({
          caso_id: caso.id,
          tipo_receptor: receptor,
          receptor_id: receptorId,
          monto_total: monto
        })
        .select("id")
        .single();

      if (errorFactura || !factura) {
        resultados.push({
          fila,
          ok: false,
          error: `Se creó el movimiento pero no se pudo generar la factura para cobrarlo: ${errorFactura?.message ?? "—"}`
        });
        continue;
      }

      await supabase.from("movimientos_caso").update({ factura_id: factura.id }).eq("id", movimiento.id);

      const { error: errorCobro } = await supabase.from("cobros").insert({
        factura_id: factura.id,
        monto,
        fecha,
        caja_id: cajaParaPagadoOCobrado,
        cuenta_contable_id: cuentaFinal
      });

      if (errorCobro) {
        resultados.push({
          fila,
          ok: false,
          error: `Se creó el movimiento y la factura pero no se pudo registrar el cobro: ${errorCobro.message}`
        });
        continue;
      }

      await recalcularEstadoFactura(factura.id);
      resumen += " · cobrado";
    } else if (concepto.tipo === "egreso" && marcado) {
      resumen += " · pagado";
    }

    await registrarCambio(caso.id, `Importación masiva: agregó movimiento ${concepto.nombre}`, `$${monto}`);
    creados++;
    resultados.push({ fila, ok: true, resumen });
  }

  return NextResponse.json({
    dryRun: !!dryRun,
    total: objetos.length,
    ok: resultados.filter((r) => r.ok).length,
    errores: resultados.filter((r) => !r.ok).length,
    creados,
    resultados
  });
}
