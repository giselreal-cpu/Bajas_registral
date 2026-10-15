import type { SupabaseClient } from "@supabase/supabase-js";
import { traerTodo } from "@/lib/xlsxTabla";

// Casos 04C cuyo "Envío de documentación Cía" ya se completó pero todavía no
// se le cobró a la compañía aseguradora. En 04C el cobro a la compañía es el
// ingreso principal, así que un caso con la documentación enviada y sin
// cobrar es plata que hay que reclamar.

export const TIPO_BAJA_04C = "04C";
export const EVENTO_ENVIO_DOCUMENTACION = "Envío de documentación Cía";
export const CONCEPTO_COBRO_COMPANIA = "Cobro a la aseguradora";

export type EstadoCobroCompania = "sin_cargar" | "sin_facturar" | "facturado_sin_cobrar" | "cobrado_parcial";

export const ETIQUETA_ESTADO_COBRO: Record<EstadoCobroCompania, string> = {
  sin_cargar: "Sin cargar",
  sin_facturar: "Cargado, sin facturar",
  facturado_sin_cobrar: "Facturado, sin cobrar",
  cobrado_parcial: "Cobrado parcial"
};

export interface Caso04cSinCobro {
  id: string;
  numero_siniestro: string;
  aseguradora_id: string | null;
  aseguradora: string;
  dominio: string;
  vehiculo: string;
  estado: string;
  fecha_envio: string | null;
  dias_desde_envio: number | null;
  estado_cobro: EstadoCobroCompania;
  importe: number | null; // lo que falta cobrar (o lo cargado, si todavía no está facturado)
  cobrado: number;
}

interface FilaCaso {
  id: string;
  numero_siniestro: string;
  estado: string;
  aseguradora_id: string | null;
  aseguradora: { nombre: string } | null;
  vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  bitacora: { tipo_evento: string; completado: boolean; fecha_inicio: string | null; fecha_fin: string | null }[];
  movimientos_caso: { monto: number; anulado: boolean; concepto: { nombre: string; tipo: string } | null }[];
  facturas: {
    tipo_receptor: string;
    monto_total: number;
    cobros: { monto: number; anulado: boolean }[];
    notas_credito: { monto: number; anulado: boolean }[];
  }[];
}

export async function obtenerCasos04cSinCobro(
  supabase: SupabaseClient,
  aseguradoraId?: string | null
): Promise<Caso04cSinCobro[]> {
  const filas = await traerTodo<FilaCaso>((d, h) => {
    let q = supabase
      .from("casos")
      .select(
        `
        id, numero_siniestro, estado, aseguradora_id,
        aseguradora:aseguradoras(nombre),
        vehiculo:vehiculos(dominio, marca, modelo, anio),
        tipo_baja:tipos_baja!inner(nombre),
        bitacora(tipo_evento, completado, fecha_inicio, fecha_fin),
        movimientos_caso(monto, anulado, concepto:conceptos_movimiento(nombre, tipo)),
        facturas(tipo_receptor, monto_total, cobros(monto, anulado), notas_credito(monto, anulado))
      `
      )
      .eq("tipo_baja.nombre", TIPO_BAJA_04C);
    if (aseguradoraId) q = q.eq("aseguradora_id", aseguradoraId);
    return q.order("id").range(d, h) as unknown as PromiseLike<{ data: FilaCaso[] | null; error?: { message: string } }>;
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const resultado: Caso04cSinCobro[] = [];

  for (const c of filas) {
    const envio = c.bitacora
      .filter((b) => b.tipo_evento === EVENTO_ENVIO_DOCUMENTACION && b.completado)
      .sort((a, b) => (b.fecha_fin ?? b.fecha_inicio ?? "").localeCompare(a.fecha_fin ?? a.fecha_inicio ?? ""))[0];
    if (!envio) continue;

    const facturasCompania = c.facturas.filter((f) => f.tipo_receptor === "compania");
    let facturado = 0;
    let cobrado = 0;
    for (const f of facturasCompania) {
      facturado += Number(f.monto_total);
      cobrado +=
        f.cobros.filter((x) => !x.anulado).reduce((a, x) => a + Number(x.monto), 0) +
        f.notas_credito.filter((x) => !x.anulado).reduce((a, x) => a + Number(x.monto), 0);
    }
    const saldo = facturado - cobrado;

    // Ya cobrado por completo: no corresponde al reporte.
    if (facturasCompania.length > 0 && cobrado > 0 && saldo <= 0.005) continue;

    const movimientosCobro = c.movimientos_caso.filter(
      (m) => !m.anulado && m.concepto?.tipo === "ingreso" && m.concepto.nombre === CONCEPTO_COBRO_COMPANIA
    );
    const cargado = movimientosCobro.reduce((a, m) => a + Number(m.monto), 0);

    let estado_cobro: EstadoCobroCompania;
    let importe: number | null;
    if (facturasCompania.length > 0) {
      estado_cobro = cobrado > 0 ? "cobrado_parcial" : "facturado_sin_cobrar";
      importe = saldo;
    } else if (movimientosCobro.length > 0) {
      estado_cobro = "sin_facturar";
      importe = cargado;
    } else {
      estado_cobro = "sin_cargar";
      importe = null;
    }

    const fechaEnvio = envio.fecha_fin ?? envio.fecha_inicio;
    const dias = fechaEnvio
      ? Math.floor((hoy.getTime() - new Date(fechaEnvio.slice(0, 10) + "T00:00:00").getTime()) / 86400000)
      : null;

    resultado.push({
      id: c.id,
      numero_siniestro: c.numero_siniestro,
      aseguradora_id: c.aseguradora_id,
      aseguradora: c.aseguradora?.nombre ?? "Sin aseguradora",
      dominio: c.vehiculo?.dominio ?? "",
      vehiculo: [c.vehiculo?.marca, c.vehiculo?.modelo, c.vehiculo?.anio].filter(Boolean).join(" "),
      estado: c.estado,
      fecha_envio: fechaEnvio ? fechaEnvio.slice(0, 10) : null,
      dias_desde_envio: dias,
      estado_cobro,
      importe,
      cobrado
    });
  }

  // Los que hace más tiempo que se enviaron la documentación, primero.
  return resultado.sort(
    (a, b) =>
      (a.fecha_envio ?? "9999").localeCompare(b.fecha_envio ?? "9999") ||
      a.aseguradora.localeCompare(b.aseguradora)
  );
}
