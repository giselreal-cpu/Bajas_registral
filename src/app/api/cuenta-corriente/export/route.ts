import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarXlsxTabla, xlsxResponse } from "@/lib/xlsxTabla";
import { ESTADOS_FACTURA } from "@/types/database";

interface FacturaExport {
  id: string;
  numero_factura: number;
  monto_total: number;
  estado: string;
  fecha_emision: string;
  caso: {
    numero_siniestro: string;
    vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  } | null;
  movimientos_caso: { concepto: { nombre: string } | null }[] | null;
  cobros: { monto: number; fecha: string; medio_pago: string | null; anulado: boolean }[] | null;
  notas_credito: { monto: number; fecha: string; motivo: string; anulado: boolean }[] | null;
}

// GET /api/cuenta-corriente/export?tipo=compania|desarmadero&id=<receptor_id>
// -> Excel con el detalle completo de la cuenta corriente de ese tercero:
// una fila por factura, con el detalle de cobros y notas de crédito
// incluido en columnas aparte (no solo el agregado que ya se ve en pantalla).
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const tipo = searchParams.get("tipo");
  const id = searchParams.get("id");

  if (!tipo || !id || (tipo !== "compania" && tipo !== "desarmadero")) {
    return new Response("Faltan parámetros: tipo (compania|desarmadero) e id.", { status: 400 });
  }

  const [{ data: facturas, error }, { data: tercero }] = await Promise.all([
    supabase
      .from("facturas")
      .select(
        `
        id, numero_factura, monto_total, estado, fecha_emision,
        caso:casos(numero_siniestro, vehiculo:vehiculos(dominio, marca, modelo, anio)),
        movimientos_caso(concepto:conceptos_movimiento(nombre)),
        cobros(monto, fecha, medio_pago, anulado),
        notas_credito(monto, fecha, motivo, anulado)
      `
      )
      .eq("tipo_receptor", tipo)
      .eq("receptor_id", id)
      .order("fecha_emision", { ascending: false }),
    supabase.from(tipo === "compania" ? "aseguradoras" : "desarmaderos").select("nombre").eq("id", id).maybeSingle()
  ]);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filas = ((facturas as unknown as FacturaExport[] | null) ?? []).map((f) => {
    const cobrado = (f.cobros ?? []).filter((c) => !c.anulado).reduce((acc, c) => acc + Number(c.monto), 0);
    const acreditadoPorNotas = (f.notas_credito ?? [])
      .filter((n) => !n.anulado)
      .reduce((acc, n) => acc + Number(n.monto), 0);
    const servicios = Array.from(
      new Set((f.movimientos_caso ?? []).map((m) => m.concepto?.nombre).filter((n): n is string => !!n))
    ).join(", ");
    const detalleCobros = (f.cobros ?? [])
      .map(
        (c) =>
          `${c.fecha}: $${c.monto}${c.medio_pago ? ` (${c.medio_pago})` : ""}${c.anulado ? " [ANULADO]" : ""}`
      )
      .join("; ");
    const detalleNotas = (f.notas_credito ?? [])
      .map((n) => `${n.fecha}: $${n.monto} - ${n.motivo}${n.anulado ? " [ANULADO]" : ""}`)
      .join("; ");

    const vehiculo = [f.caso?.vehiculo?.marca, f.caso?.vehiculo?.modelo, f.caso?.vehiculo?.anio]
      .filter(Boolean)
      .join(" ");

    return {
      numero_factura: f.numero_factura,
      caso: f.caso?.numero_siniestro ?? "",
      dominio: f.caso?.vehiculo?.dominio ?? "",
      vehiculo,
      servicios,
      fecha_emision: f.fecha_emision,
      total: f.monto_total,
      cobrado,
      notas_credito: acreditadoPorNotas,
      saldo: f.monto_total - cobrado - acreditadoPorNotas,
      estado: ESTADOS_FACTURA.find((e) => e.value === f.estado)?.label ?? f.estado,
      detalle_cobros: detalleCobros,
      detalle_notas_credito: detalleNotas
    };
  });

  const buffer = await generarXlsxTabla(
    "Cuenta corriente",
    [
      { key: "numero_factura", label: "N° Factura", tipo: "texto", ancho: 12 },
      { key: "caso", label: "Caso", tipo: "texto", ancho: 18 },
      { key: "dominio", label: "Dominio", tipo: "texto", ancho: 11 },
      { key: "vehiculo", label: "Marca/Modelo/Año", ancho: 32 },
      { key: "servicios", label: "Servicio(s)", ancho: 32 },
      { key: "fecha_emision", label: "Fecha Emisión", tipo: "fecha" },
      { key: "total", label: "Total", tipo: "moneda" },
      { key: "cobrado", label: "Cobrado", tipo: "moneda" },
      { key: "notas_credito", label: "Notas de Crédito", tipo: "moneda" },
      { key: "saldo", label: "Saldo", tipo: "moneda" },
      { key: "estado", label: "Estado", ancho: 16 },
      { key: "detalle_cobros", label: "Detalle de Cobros", ancho: 50 },
      { key: "detalle_notas_credito", label: "Detalle de Notas de Crédito", ancho: 50 }
    ],
    filas
  );

  const nombreTercero = (tercero?.nombre ?? "tercero").replace(/[^a-zA-Z0-9]+/g, "_");
  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `cuenta_corriente_${nombreTercero}_${fecha}.xlsx`);
}
