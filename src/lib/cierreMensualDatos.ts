import type { SupabaseClient } from "@supabase/supabase-js";
import type { Aplicacion, Caja, Comprobante, DatosCierre, MovTesoreria, SaldoDeclarado } from "./cierreMensual";

const PAGINA = 1000;

// PostgREST corta cada respuesta en 1000 filas: se pide por páginas hasta
// traer todo (mismo motivo que traerTodo en panelData.ts).
async function traerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return filas;
}

const num = (v: unknown) => Number(v ?? 0);

export async function obtenerDatosCierre(supabase: SupabaseClient): Promise<DatosCierre> {
  const [comprobantes, aplicaciones, movimientos, cajas] = await Promise.all([
    traerTodo<Record<string, unknown>>((d, h) =>
      supabase.from("v_comprobantes").select("*").order("comprobante_id").range(d, h)
    ),
    traerTodo<Record<string, unknown>>((d, h) =>
      supabase.from("v_aplicaciones").select("*").order("aplicacion_id").range(d, h)
    ),
    traerTodo<Record<string, unknown>>((d, h) =>
      supabase.from("v_movimientos_tesoreria").select("*").order("movimiento_id").range(d, h)
    ),
    traerTodo<Record<string, unknown>>((d, h) =>
      supabase.from("v_cajas_liquidez").select("*").order("nombre").range(d, h)
    )
  ]);

  return {
    comprobantes: comprobantes.map((c) => ({
      ...(c as unknown as Comprobante),
      monto_total: num(c.monto_total),
      monto_neto: num(c.monto_neto),
      iva: num(c.iva),
      retenciones: num(c.retenciones)
    })),
    aplicaciones: aplicaciones.map((a) => ({ ...(a as unknown as Aplicacion), monto: num(a.monto) })),
    movimientos: movimientos.map((m) => ({ ...(m as unknown as MovTesoreria), monto: num(m.monto) })),
    cajas: cajas.map((c) => ({
      id: c.id as string,
      nombre: c.nombre as string,
      grupo: c.grupo as Caja["grupo"],
      tipo: c.tipo as string,
      moneda: c.moneda as string,
      saldo_inicial: num(c.saldo_inicial)
    }))
  };
}

export async function obtenerSaldosDeclarados(supabase: SupabaseClient, mes: string): Promise<SaldoDeclarado[]> {
  const { data, error } = await supabase
    .from("cierres_saldos_declarados")
    .select("caja_id, tipo, saldo_declarado")
    .eq("mes", mes);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({ ...d, saldo_declarado: num(d.saldo_declarado) })) as SaldoDeclarado[];
}
