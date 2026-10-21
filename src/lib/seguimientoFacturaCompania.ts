import type { SupabaseClient } from "@supabase/supabase-js";
import { traerTodo } from "@/lib/xlsxTabla";

// Bajas ya pagadas a la compañía de las que todavía no se recibió la factura
// (control en el detalle financiero del caso, sobre los movimientos
// "Pago a la compañía"). Un caso con varios pagos parciales aparece una sola
// vez, con la suma de lo pagado sin factura.

export const CONCEPTO_PAGO_COMPANIA = "Pago a la compañía";

export interface BajaPagadaSinFactura {
  caso_id: string;
  numero_siniestro: string;
  aseguradora_id: string | null;
  aseguradora: string;
  dominio: string;
  tipo_baja: string;
  estado: string;
  fecha_pago: string | null;
  dias_desde_pago: number | null;
  monto: number;
  pagos: number;
}

interface FilaMovimiento {
  monto: number;
  fecha: string;
  fecha_pago: string | null;
  caso_id: string;
  caso: {
    numero_siniestro: string;
    estado: string;
    aseguradora_id: string | null;
    aseguradora: { nombre: string } | null;
    vehiculo: { dominio: string } | null;
    tipo_baja: { nombre: string } | null;
  } | null;
}

export async function obtenerBajasPagadasSinFactura(
  supabase: SupabaseClient,
  aseguradoraId?: string | null
): Promise<BajaPagadaSinFactura[]> {
  const { data: concepto } = await supabase
    .from("conceptos_movimiento")
    .select("id")
    .eq("nombre", CONCEPTO_PAGO_COMPANIA)
    .eq("tipo", "egreso")
    .maybeSingle();
  if (!concepto) return [];

  const filas = await traerTodo<FilaMovimiento>((d, h) => {
    let q = supabase
      .from("movimientos_caso")
      .select(
        `
        monto, fecha, fecha_pago, caso_id,
        caso:casos!inner(
          numero_siniestro, estado, aseguradora_id,
          aseguradora:aseguradoras(nombre),
          vehiculo:vehiculos(dominio),
          tipo_baja:tipos_baja(nombre)
        )
      `
      )
      .eq("concepto_id", concepto.id)
      .eq("pagado", true)
      .eq("anulado", false)
      .eq("aprobado", true)
      .eq("factura_compania_recibida", false);
    if (aseguradoraId) q = q.eq("caso.aseguradora_id", aseguradoraId);
    return q.order("id").range(d, h) as unknown as PromiseLike<{ data: FilaMovimiento[] | null; error?: { message: string } }>;
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const porCaso = new Map<string, BajaPagadaSinFactura>();
  for (const f of filas) {
    const fechaPago = f.fecha_pago ?? f.fecha;
    const actual = porCaso.get(f.caso_id);
    if (actual) {
      actual.monto += Number(f.monto);
      actual.pagos += 1;
      if (!actual.fecha_pago || fechaPago > actual.fecha_pago) actual.fecha_pago = fechaPago;
      continue;
    }
    porCaso.set(f.caso_id, {
      caso_id: f.caso_id,
      numero_siniestro: f.caso?.numero_siniestro ?? "—",
      aseguradora_id: f.caso?.aseguradora_id ?? null,
      aseguradora: f.caso?.aseguradora?.nombre ?? "Sin aseguradora",
      dominio: f.caso?.vehiculo?.dominio ?? "",
      tipo_baja: f.caso?.tipo_baja?.nombre ?? "",
      estado: f.caso?.estado ?? "",
      fecha_pago: fechaPago,
      dias_desde_pago: null,
      monto: Number(f.monto),
      pagos: 1
    });
  }

  const lista = Array.from(porCaso.values());
  for (const b of lista) {
    b.dias_desde_pago = b.fecha_pago
      ? Math.floor((hoy.getTime() - new Date(b.fecha_pago.slice(0, 10) + "T00:00:00").getTime()) / 86400000)
      : null;
  }
  // Los pagos más antiguos primero: son los que hay que reclamar antes.
  return lista.sort(
    (a, b) => (a.fecha_pago ?? "9999").localeCompare(b.fecha_pago ?? "9999") || a.aseguradora.localeCompare(b.aseguradora)
  );
}
