import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { obtenerDatosPanel, promedio, PanelFiltros } from "@/lib/panelData";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";
import { calcularCierre, combinarRentabilidad, ultimosMeses } from "@/lib/cierreMensual";
import { obtenerDatosCierre } from "@/lib/cierreMensualDatos";
import ComparativoGraficos from "@/components/administracion/cierre/ComparativoGraficos";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function pesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function porcentaje(valor: number | null): string {
  return valor === null ? "N/A" : `${valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
}

function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type SearchParams = PanelFiltros & { periodo?: string; ranking?: string };

// Centro de indicadores: rentabilidad (gráficos y ranking), tiempos de trámite
// y satisfacción. Cada dato vive en un solo lugar de la plataforma — el Panel
// queda para lo operativo del día y el Cierre mensual para lo contable.
// Mismo criterio de acceso que Administración: la compañía no ve información
// financiera interna.
export default async function AnalisisPage({ searchParams }: { searchParams: SearchParams }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">Esta sección es información financiera interna.</p>
      </div>
    );
  }

  const supabase = createClient();
  const datos = await obtenerDatosPanel(searchParams);
  const {
    errores,
    aseguradoras,
    tiposBaja,
    tramitadores,
    hayFiltrosPanel,
    casosConTiempos,
    promedioTramite,
    casosConPresentacion,
    promedioPresentacionCierre,
    encuestasEnviadas,
    encuestasRespondidas,
    encuestasSinResponder,
    promedioContacto,
    promedioTraslado,
    promedioGestoria
  } = datos;

  // Mismos filtros, para que "Ver detalle →" lleve a /panel/detalle con el mismo recorte.
  const queryFiltros = new URLSearchParams();
  if (searchParams.aseguradora_id) queryFiltros.set("aseguradora_id", searchParams.aseguradora_id);
  if (searchParams.mes) queryFiltros.set("mes", searchParams.mes);
  if (searchParams.tipo_baja_id) queryFiltros.set("tipo_baja_id", searchParams.tipo_baja_id);
  if (searchParams.tramitador_id) queryFiltros.set("tramitador_id", searchParams.tramitador_id);
  const qs = queryFiltros.toString();
  const hrefDetalle = (ancla: string) => `/panel/detalle${qs ? `?${qs}` : ""}#${ancla}`;

  // ---- Rentabilidad (devengado, neto según el criterio de IVA del cierre) ----
  const mes = /^\d{4}-\d{2}$/.test(searchParams.periodo ?? "") ? searchParams.periodo! : new Date().toISOString().slice(0, 7);
  const datosCierre = await obtenerDatosCierre(supabase as unknown as SupabaseClient);
  const comparativo = ultimosMeses(mes, 12).map((m) => calcularCierre(m, datosCierre));
  const r = comparativo[comparativo.length - 1];

  // ---- Ranking de rentabilidad (mes seleccionado o últimos 12 meses) ----
  const rankingModo = searchParams.ranking === "12m" ? "12m" : "mes";
  const rentabilidad = combinarRentabilidad(rankingModo === "12m" ? comparativo : [r]);
  const mejoresCasos = rentabilidad.casos.slice(0, 10);
  const peoresCasos = rentabilidad.casos.length > 10 ? rentabilidad.casos.slice(-5).reverse() : [];

  // Casos que cerraron en el período del ranking, tengan o no movimientos: un
  // caso cerrado sin ningún ingreso ni gasto cargado no aporta resultado, así
  // que no aparece en las listas — se cuenta aparte para que los totales cierren.
  const rangoRankingDesde = `${rankingModo === "12m" ? ultimosMeses(mes, 12)[0] : mes}-01`;
  const rangoRankingHasta = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).toISOString().slice(0, 10);
  const { data: cerradosRankingRaw } = await supabase
    .from("casos")
    .select("id, aseguradora_id, vehiculo:vehiculos(dominio)")
    .gte("fecha_cierre", rangoRankingDesde)
    .lte("fecha_cierre", rangoRankingHasta);
  const cerradosRanking = (cerradosRankingRaw ?? []) as unknown as {
    id: string;
    aseguradora_id: string | null;
    vehiculo: { dominio: string } | null;
  }[];
  const idsConMovimientos = new Set(rentabilidad.casos.map((c) => c.caso_id));
  const casosSinMovimientos = cerradosRanking.filter((c) => !idsConMovimientos.has(c.id));
  const cerradosPorAseguradora = new Map<string, number>();
  for (const c of cerradosRanking) {
    const k = c.aseguradora_id ?? "sin";
    cerradosPorAseguradora.set(k, (cerradosPorAseguradora.get(k) ?? 0) + 1);
  }
  const filasAseguradoras = [...rentabilidad.aseguradoras];
  for (const k of Array.from(cerradosPorAseguradora.keys())) {
    if (!filasAseguradoras.some((a) => (a.aseguradora_id ?? "sin") === k)) {
      filasAseguradoras.push({
        aseguradora_id: k === "sin" ? null : k,
        casos: 0,
        ingresos: 0,
        egresos: 0,
        resultado: 0,
        margen: null
      });
    }
  }

  const { data: aseguradorasRentabilidad } = await supabase.from("aseguradoras").select("id, nombre");
  const aseguradoraNombre = new Map((aseguradorasRentabilidad ?? []).map((a) => [a.id, a.nombre]));
  const idsCasoRanking = [...mejoresCasos, ...peoresCasos].map((c) => c.caso_id);
  const casoLabel = new Map<string, string>();
  if (idsCasoRanking.length > 0) {
    const { data } = await supabase
      .from("casos")
      .select("id, numero_siniestro, vehiculo:vehiculos(dominio)")
      .in("id", idsCasoRanking);
    for (const c of (data ?? []) as unknown as { id: string; numero_siniestro: string; vehiculo: { dominio: string } | null }[]) {
      casoLabel.set(c.id, `${c.vehiculo?.dominio ?? "—"} · ${c.numero_siniestro}`);
    }
  }

  // ---- Días promedio por etapa: duración de cada tipo de evento completado
  // (fecha_inicio → fecha_fin), promediado entre todos los casos. ----
  const { data: eventosCompletos } = await supabase
    .from("bitacora")
    .select("tipo_evento, fecha_inicio, fecha_fin")
    .eq("completado", true)
    .not("fecha_inicio", "is", null)
    .not("fecha_fin", "is", null);

  const duracionesPorTipo = new Map<string, number[]>();
  for (const ev of (eventosCompletos ?? []) as { tipo_evento: string; fecha_inicio: string; fecha_fin: string }[]) {
    const dias = Math.round((new Date(ev.fecha_fin).getTime() - new Date(ev.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0) continue;
    const lista = duracionesPorTipo.get(ev.tipo_evento) ?? [];
    lista.push(dias);
    duracionesPorTipo.set(ev.tipo_evento, lista);
  }
  const diasPorEtapa = TIPOS_EVENTO.map((t) => ({
    label: t.label,
    promedio: promedio(duracionesPorTipo.get(t.label) ?? []),
    cantidad: (duracionesPorTipo.get(t.label) ?? []).length
  })).filter((e) => e.cantidad > 0);
  const maxDias = Math.max(1, ...diasPorEtapa.map((e) => e.promedio ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold text-brand-900">Análisis</h1>
        <p className="text-sm text-slate-500">
          Rentabilidad, tiempos de trámite y satisfacción de la cartera. El día a día está en el Panel y la
          contabilidad del mes en Cierre mensual.
        </p>
      </div>

      {(errores.errorCasos || errores.errorCerrados || errores.errorPresentacion) && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">
          {errores.errorCasos?.message || errores.errorCerrados?.message || errores.errorPresentacion?.message}
        </div>
      )}

      <form className="card p-4 flex flex-wrap gap-3 items-end" method="get">
        <div className="flex-1 min-w-[160px]">
          <label className="label">Período de rentabilidad</label>
          <input type="month" name="periodo" defaultValue={mes} className="input" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Compañía (tiempos y satisfacción)</label>
          <select name="aseguradora_id" defaultValue={searchParams.aseguradora_id ?? ""} className="input">
            <option value="">Todas</option>
            {aseguradoras?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Mes de ingreso</label>
          <input type="month" name="mes" defaultValue={searchParams.mes ?? ""} className="input" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Tipo de baja</label>
          <select name="tipo_baja_id" defaultValue={searchParams.tipo_baja_id ?? ""} className="input">
            <option value="">Todos</option>
            {tiposBaja?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Trámitador</label>
          <select name="tramitador_id" defaultValue={searchParams.tramitador_id ?? ""} className="input">
            <option value="">Todos</option>
            {(
              tramitadores as unknown as
                | { id: string; nombre: string; aseguradora_id: string | null; aseguradora: { nombre: string } | null }[]
                | null
            )
              ?.filter((t) => !searchParams.aseguradora_id || t.aseguradora_id === searchParams.aseguradora_id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {!searchParams.aseguradora_id && t.aseguradora ? ` — ${t.aseguradora.nombre}` : ""}
                </option>
              ))}
          </select>
        </div>
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
        {(hayFiltrosPanel || searchParams.periodo) && (
          <Link href="/analisis" className="btn-secondary">
            Quitar filtros
          </Link>
        )}
      </form>

      <section className="card p-4">
        <h2 className="font-heading font-semibold text-slate-800 mb-1">Rentabilidad — evolución de 12 meses</h2>
        <p className="text-xs text-slate-400 mb-3">
          Devengado por mes de cierre del caso, hasta {nombreMes(mes)}. El detalle contable de cada mes está en
          Cierre mensual.
        </p>
        <ComparativoGraficos
          puntos={comparativo.map((c) => ({ mes: c.mes, ganancia: c.ganancia, roi: c.roi, saldo: c.saldo_cajas_total }))}
        />
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium text-slate-800">Ranking de rentabilidad</h2>
          <div className="flex gap-2">
            {(["mes", "12m"] as const).map((modo) => (
              <Link
                key={modo}
                href={`/analisis?${new URLSearchParams({
                  ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => typeof v === "string" && v)),
                  periodo: mes,
                  ranking: modo
                } as Record<string, string>).toString()}`}
                className={`btn-secondary text-xs ${rankingModo === modo ? "!bg-brand-900 !text-white" : ""}`}
              >
                {modo === "mes" ? nombreMes(mes) : "Últimos 12 meses"}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Resultado = ingresos − egresos netos de IVA de los comprobantes devengados en el período, por aseguradora y
          por caso. Solo entran los comprobantes asociados a un caso.
        </p>

        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Por aseguradora</h3>
        {filasAseguradoras.length === 0 ? (
          <p className="text-sm text-slate-400 mb-4">Sin comprobantes con caso en este período.</p>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">#</th>
                  <th className="py-1 pr-3 font-medium">Aseguradora</th>
                  <th className="py-1 pr-3 font-medium text-right">Casos cerrados</th>
                  <th className="py-1 pr-3 font-medium text-right">Con movimientos</th>
                  <th className="py-1 pr-3 font-medium text-right">Ingresos</th>
                  <th className="py-1 pr-3 font-medium text-right">Egresos</th>
                  <th className="py-1 pr-3 font-medium text-right">Resultado</th>
                  <th className="py-1 pr-3 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {filasAseguradoras.map((a, i) => (
                  <tr key={a.aseguradora_id ?? "sin"} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-1.5 pr-3">
                      {a.aseguradora_id ? aseguradoraNombre.get(a.aseguradora_id) ?? "—" : "Sin aseguradora"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {cerradosPorAseguradora.get(a.aseguradora_id ?? "sin") ?? 0}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{a.casos}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(a.ingresos)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(a.egresos)}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${a.resultado < 0 ? "text-red-600" : ""}`}>
                      {pesos(a.resultado)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{porcentaje(a.margen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-2">
              Cerraron <b>{cerradosRanking.length}</b> casos en el período: <b>{cerradosRanking.length - casosSinMovimientos.length}</b>{" "}
              tienen ingresos o gastos cargados y entran al resultado
              {casosSinMovimientos.length > 0 && (
                <>
                  ; <b>{casosSinMovimientos.length}</b> no tienen ningún movimiento cargado, así que no aportan resultado (
                  {casosSinMovimientos
                    .map((c) => c.vehiculo?.dominio)
                    .filter(Boolean)
                    .join(", ")}
                  ).
                </>
              )}
            </p>
          </div>
        )}

        {[
          { titulo: "Casos más rentables", lista: mejoresCasos },
          { titulo: "Casos menos rentables", lista: peoresCasos }
        ].map(({ titulo, lista }) =>
          lista.length === 0 ? null : (
            <div key={titulo} className="mb-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">{titulo}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Caso</th>
                      <th className="py-1 pr-3 font-medium">Aseguradora</th>
                      <th className="py-1 pr-3 font-medium text-right">Ingresos</th>
                      <th className="py-1 pr-3 font-medium text-right">Egresos</th>
                      <th className="py-1 pr-3 font-medium text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((c) => (
                      <tr key={c.caso_id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3">
                          <Link href={`/casos/${c.caso_id}/rentabilidad`} className="text-brand-600 hover:underline">
                            {casoLabel.get(c.caso_id) ?? c.caso_id}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3">
                          {c.aseguradora_id ? aseguradoraNombre.get(c.aseguradora_id) ?? "—" : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.ingresos)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.egresos)}</td>
                        <td className={`py-1.5 pr-3 text-right tabular-nums ${c.resultado < 0 ? "text-red-600" : ""}`}>
                          {pesos(c.resultado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-heading font-semibold text-slate-800 mb-3">Tiempos de trámite</h2>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Casos cerrados</h3>
          <Link href={hrefDetalle("tiempos")} className="text-sm text-brand-600 hover:underline">
            Ver detalle →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Trámite completo (promedio)" value={promedioTramite ?? 0} sufijo=" días" />
          <StatCard label="Casos cerrados analizados" value={casosConTiempos.length} />
          <StatCard label="Presentación → cierre (promedio)" value={promedioPresentacionCierre ?? 0} sufijo=" días" />
          <StatCard label="Casos con ese dato" value={casosConPresentacion.length} />
        </div>

        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Días promedio por etapa</h3>
        {diasPorEtapa.length > 0 ? (
          <div className="space-y-3">
            {diasPorEtapa.map((e) => (
              <div key={e.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700">{e.label}</span>
                  <span className="text-slate-500">
                    {e.promedio ?? 0} días · {e.cantidad} {e.cantidad === 1 ? "caso" : "casos"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-silver-200 overflow-hidden">
                  <div
                    className="h-full bg-accent-600 rounded-full"
                    style={{ width: `${Math.max(Math.round(((e.promedio ?? 0) / maxDias) * 100), 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Todavía no hay eventos completados con fechas cargadas.</p>
        )}
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-slate-800">Encuestas de satisfacción</h2>
          <Link href={hrefDetalle("encuestas")} className="text-sm text-brand-600 hover:underline">
            Ver detalle →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard label="Enviadas" value={encuestasEnviadas} />
          <StatCard label="Respondidas" value={encuestasRespondidas} />
          <StatCard label="Sin responder" value={encuestasSinResponder} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Contacto inicial (promedio)" value={promedioContacto ?? 0} sufijo="/5" />
          <StatCard label="Traslado (promedio)" value={promedioTraslado ?? 0} sufijo="/5" />
          <StatCard label="Gestoría (promedio)" value={promedioGestoria ?? 0} sufijo="/5" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sufijo,
  sub
}: {
  label: string;
  value: number | string;
  sufijo?: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {value}
        {sufijo && <span className="text-base font-normal text-slate-500">{sufijo}</span>}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
