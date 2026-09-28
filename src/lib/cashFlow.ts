import { createClient } from "@/lib/supabase/server";

const SEMANAS_ADELANTE = 8;

export interface SemanaCashFlow {
  inicio: string; // YYYY-MM-DD, lunes de la semana
  fin: string; // YYYY-MM-DD, domingo de la semana
  porCobrar: number;
  porPagar: number;
  neto: number;
  liquidezProyectada: number;
}

export interface DatosCashFlow {
  liquidezActual: number;
  semanas: SemanaCashFlow[];
  totalPorCobrar: number;
  totalPorPagar: number;
  vencidoSinCobrar: number;
}

function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dia = d.getDay(); // 0 = domingo
  const offset = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + offset);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Cash flow proyectado, semana a semana, a partir de la plata que
// realmente falta cobrar (saldo de facturas) y pagar (egresos aprobados
// y todavía no pagados) — no inventa negocio nuevo, solo distribuye en
// el tiempo lo que ya está cargado en el sistema. La fecha que se usa
// para ubicar cada pendiente en una semana:
// - Facturas: fecha_vencimiento (o fecha_emision si no tiene).
// - Egresos: la fecha del movimiento.
// Todo lo que ya venció (fecha pasada) se suma en la semana actual, no
// desaparece ni se empuja para adelante.
export async function obtenerCashFlow(): Promise<DatosCashFlow> {
  const supabase = createClient();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioSemanaActual = lunesDe(hoy);

  const [
    { data: cajas },
    { data: cobrosPagados },
    { data: anticipos },
    { data: movsPagados },
    { data: generales },
    { data: facturasAbiertas },
    { data: egresosPendientes }
  ] = await Promise.all([
    supabase.from("cajas").select("id, saldo_inicial").eq("activa", true),
    supabase.from("cobros").select("monto").eq("anulado", false),
    supabase.from("anticipos").select("monto"),
    supabase
      .from("movimientos_caso")
      .select("monto, concepto:conceptos_movimiento(tipo)")
      .eq("aprobado", true)
      .eq("pagado", true)
      .eq("anulado", false),
    supabase.from("movimientos_generales").select("monto, tipo").eq("anulado", false),
    supabase
      .from("facturas")
      .select(
        "id, monto_total, fecha_emision, fecha_vencimiento, cobros(monto, anulado), notas_credito(monto, anulado)"
      )
      .neq("estado", "cobrado_total"),
    // Solo egresos: un movimiento_caso pendiente de tipo "ingreso" (ej.
    // "Cobro al desarmadero") es plata que falta COBRAR, no pagar — ese
    // lado ya lo cubre el saldo de facturas de más abajo.
    supabase
      .from("movimientos_caso")
      .select("monto, fecha, concepto:conceptos_movimiento(tipo)")
      .eq("aprobado", true)
      .eq("pagado", false)
      .eq("anulado", false)
  ]);

  // Liquidez actual = saldo inicial de cada caja + todo lo efectivamente
  // cobrado/pagado hasta hoy (mismo criterio que "Liquidez" en
  // Administración, sin filtro de fecha ni de caja puntual).
  const saldoInicial = (cajas ?? []).reduce((acc, c) => acc + Number(c.saldo_inicial), 0);
  const totalCobrado =
    (cobrosPagados ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
    (anticipos ?? []).reduce((acc, a) => acc + Number(a.monto), 0);
  const totalMovsPagados = (
    (movsPagados ?? []) as unknown as { monto: number; concepto: { tipo: string } | null }[]
  ).reduce((acc, m) => acc + (m.concepto?.tipo === "egreso" ? -Number(m.monto) : Number(m.monto)), 0);
  const totalGenerales = (
    (generales ?? []) as unknown as { monto: number; tipo: string }[]
  ).reduce((acc, m) => acc + (m.tipo === "egreso" ? -Number(m.monto) : Number(m.monto)), 0);
  const liquidezActual = saldoInicial + totalCobrado + totalMovsPagados + totalGenerales;

  const semanas: SemanaCashFlow[] = [];
  for (let i = 0; i < SEMANAS_ADELANTE; i++) {
    const inicio = new Date(inicioSemanaActual);
    inicio.setDate(inicio.getDate() + i * 7);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    semanas.push({ inicio: toISODate(inicio), fin: toISODate(fin), porCobrar: 0, porPagar: 0, neto: 0, liquidezProyectada: 0 });
  }

  // Ubica una fecha en el índice de semana correspondiente — todo lo
  // anterior a la semana actual (vencido) cae en el índice 0.
  function indiceSemana(fechaStr: string): number {
    const fecha = new Date(fechaStr + "T00:00:00");
    const dias = Math.floor((fecha.getTime() - inicioSemanaActual.getTime()) / (1000 * 60 * 60 * 24));
    const idx = Math.floor(dias / 7);
    return Math.min(Math.max(idx, 0), SEMANAS_ADELANTE - 1);
  }

  let totalPorCobrar = 0;
  let vencidoSinCobrar = 0;
  for (const f of (facturasAbiertas ?? []) as unknown as {
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string | null;
    cobros: { monto: number; anulado: boolean }[];
    notas_credito: { monto: number; anulado: boolean }[];
  }[]) {
    const cobrado =
      f.cobros.filter((c) => !c.anulado).reduce((acc, c) => acc + Number(c.monto), 0) +
      f.notas_credito.filter((n) => !n.anulado).reduce((acc, n) => acc + Number(n.monto), 0);
    const saldo = Number(f.monto_total) - cobrado;
    if (saldo <= 0) continue;

    const fechaEstimativa = f.fecha_vencimiento ?? f.fecha_emision;
    totalPorCobrar += saldo;
    if (new Date(fechaEstimativa + "T00:00:00") < inicioSemanaActual) vencidoSinCobrar += saldo;
    semanas[indiceSemana(fechaEstimativa)].porCobrar += saldo;
  }

  let totalPorPagar = 0;
  for (const m of (egresosPendientes ?? []) as unknown as {
    monto: number;
    fecha: string;
    concepto: { tipo: string } | null;
  }[]) {
    if (m.concepto?.tipo !== "egreso") continue;
    totalPorPagar += Number(m.monto);
    semanas[indiceSemana(m.fecha)].porPagar += Number(m.monto);
  }

  let acumulado = liquidezActual;
  for (const s of semanas) {
    s.neto = s.porCobrar - s.porPagar;
    acumulado += s.neto;
    s.liquidezProyectada = acumulado;
  }

  return { liquidezActual, semanas, totalPorCobrar, totalPorPagar, vencidoSinCobrar };
}
