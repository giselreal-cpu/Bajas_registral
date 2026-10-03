import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularCierre, rangoMes, ultimosMeses, DatosCierre, ResultadoCierre } from "./cierreMensual";
import { obtenerSaldosDeclarados } from "./cierreMensualDatos";
import type { ContextoExport } from "./cierreExport";

// Resultado del mes para exportar: si el mes está cerrado sale del snapshot
// congelado (lo que se auditó al cerrar); si está abierto, se calcula en vivo.
export async function resultadoParaExportar(
  supabase: SupabaseClient,
  mes: string,
  datos: DatosCierre
): Promise<{ resultado: ResultadoCierre; congelado: boolean }> {
  const { data: cierre } = await supabase.from("cierres_mensuales").select("snapshot").eq("mes", mes).maybeSingle();
  const snap = (cierre?.snapshot as { resultado?: ResultadoCierre } | null)?.resultado;
  if (snap && snap.lineas && snap.movimientos_caja) return { resultado: snap, congelado: true };
  const declarados = await obtenerSaldosDeclarados(supabase, mes);
  return { resultado: calcularCierre(mes, datos, declarados), congelado: false };
}

export async function armarContexto(
  supabase: SupabaseClient,
  mes: string,
  resultado: ResultadoCierre,
  datos: DatosCierre,
  congelado: boolean,
  generadoPor?: string
): Promise<ContextoExport> {
  const [{ data: aseguradoras }, { data: cajas }] = await Promise.all([
    supabase.from("aseguradoras").select("id, nombre"),
    supabase.from("cajas").select("id, nombre")
  ]);

  const idsCaso = Array.from(
    new Set(
      [...resultado.lineas.map((l) => l.caso_id), ...resultado.rentabilidad_por_caso.map((c) => c.caso_id)].filter(
        (x): x is string => !!x
      )
    )
  );
  const casoLabel = new Map<string, string>();
  for (let i = 0; i < idsCaso.length; i += 200) {
    const { data } = await supabase
      .from("casos")
      .select("id, numero_siniestro, vehiculo:vehiculos(dominio)")
      .in("id", idsCaso.slice(i, i + 200));
    for (const c of (data ?? []) as unknown as { id: string; numero_siniestro: string; vehiculo: { dominio: string } | null }[]) {
      casoLabel.set(c.id, `${c.vehiculo?.dominio ?? "—"} · ${c.numero_siniestro}`);
    }
  }

  const cajaNombre = new Map((cajas ?? []).map((c) => [c.id as string, c.nombre as string]));
  const { desde, hasta } = rangoMes(mes);
  const { data: trf } = await supabase
    .from("transferencias_internas")
    .select("fecha, caja_origen_id, caja_destino_id, monto, referencia, anulado, anulado_motivo")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha");

  return {
    casoLabel,
    aseguradoraNombre: new Map((aseguradoras ?? []).map((a) => [a.id as string, a.nombre as string])),
    cajaNombre,
    transferencias: (trf ?? []).map((t) => ({
      fecha: t.fecha,
      origen: cajaNombre.get(t.caja_origen_id) ?? "—",
      destino: cajaNombre.get(t.caja_destino_id) ?? "—",
      monto: Number(t.monto),
      referencia: t.referencia,
      anulado: t.anulado,
      anulado_motivo: t.anulado_motivo
    })),
    comparativo: ultimosMeses(mes, 12).map((m) => calcularCierre(m, datos)),
    congelado,
    generadoPor
  };
}
