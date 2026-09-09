import Link from "next/link";
import { ESTADOS } from "@/types/database";
import { DatosPanelCompania } from "@/lib/panelData";

function diasDesdeHoy(fecha: string) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha + "T00:00:00");
  return Math.round((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function fechaRelativa(iso: string) {
  const fecha = new Date(iso);
  const dias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

// Vista ejecutiva de su propia cartera para el rol "compañía" —
// pensada desde cero para lo que le importa a un cliente ver, no un
// recorte del panel interno (ver obtenerDatosPanelCompania en
// panelData.ts, que ya viene scopeada por RLS a su aseguradora).
export default function PanelCompania({
  datos,
  primerNombre
}: {
  datos: DatosPanelCompania;
  primerNombre: string;
}) {
  const {
    error,
    casosAbiertos,
    casosCerradosEsteMes,
    promedioTramite,
    conteoPorEstado,
    maxConteo,
    casosPorTipoBaja,
    actividadReciente,
    vencimientosSemana
  } = datos;

  const horaActual = new Date().getHours();
  const saludo = horaActual < 12 ? "Buen día" : horaActual < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-brand-900">
          {saludo}{primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        <p className="text-sm text-slate-500">Estado general de tu cartera de casos.</p>
      </div>

      {error && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Casos abiertos" value={casosAbiertos} />
        <StatCard label="Cerrados este mes" value={casosCerradosEsteMes} />
        <StatCard
          label="Tiempo promedio de trámite"
          value={promedioTramite !== null ? promedioTramite : "—"}
          sufijo={promedioTramite !== null ? " días" : undefined}
        />
        <StatCard label="Vencimientos esta semana" value={vencimientosSemana.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Tu cartera por etapa</h2>
          <div className="space-y-3">
            {ESTADOS.map((e) => {
              const cantidad = conteoPorEstado[e.value] ?? 0;
              const pct = Math.round((cantidad / maxConteo) * 100);
              return (
                <Link key={e.value} href={`/casos?estado=${e.value}`} className="block group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 group-hover:text-brand-600">{e.label}</span>
                    <span className="text-slate-500">{cantidad}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-silver-200 overflow-hidden">
                    <div
                      className="h-full bg-accent-600 rounded-full"
                      style={{ width: `${cantidad === 0 ? 0 : Math.max(pct, 4)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Vencimientos de esta semana</h2>
          <div className="divide-y divide-slate-100">
            {vencimientosSemana.map((v) => (
              <div key={v.key} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/casos/${v.casoId}`}
                    className="text-brand-600 font-medium hover:underline text-sm"
                  >
                    {v.numeroSiniestro}
                  </Link>
                  <p className="text-sm text-slate-700 truncate">{v.detalle}</p>
                </div>
                <span className="badge bg-amber-100 text-amber-800 shrink-0">
                  {(() => {
                    const dias = diasDesdeHoy(v.fechaFin);
                    if (dias < 0) return "Vencido";
                    if (dias === 0) return "Hoy";
                    return `${dias} días`;
                  })()}
                </span>
              </div>
            ))}
            {vencimientosSemana.length === 0 && (
              <p className="text-sm text-slate-500 py-2">No hay vencimientos en los próximos 7 días.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Casos con actividad reciente</h2>
          <div className="divide-y divide-slate-100">
            {actividadReciente.map((a) => (
              <div key={a.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/casos/${a.casoId}`}
                    className="text-brand-600 font-medium hover:underline text-sm"
                  >
                    {a.numeroSiniestro}
                  </Link>
                  {a.dominio && <span className="text-slate-400 text-sm"> · {a.dominio}</span>}
                  <p className="text-sm text-slate-700 truncate">{a.tipoEvento}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{fechaRelativa(a.fecha)}</span>
              </div>
            ))}
            {actividadReciente.length === 0 && (
              <p className="text-sm text-slate-500 py-2">Todavía no hay actividad para mostrar.</p>
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Tu cartera por tipo de baja</h2>
          <div className="divide-y divide-slate-100">
            {casosPorTipoBaja.map((t) => (
              <div key={t.nombre} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{t.nombre}</span>
                <span className="text-slate-500">{t.cantidad}</span>
              </div>
            ))}
            {casosPorTipoBaja.length === 0 && (
              <p className="text-sm text-slate-500 py-2">Todavía no hay casos cargados.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sufijo
}: {
  label: string;
  value: number | string;
  sufijo?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {value}
        {sufijo && <span className="text-base font-normal text-slate-500">{sufijo}</span>}
      </p>
    </div>
  );
}
