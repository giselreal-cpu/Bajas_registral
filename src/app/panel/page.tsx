import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Caso, ESTADOS, Estado } from "@/types/database";

export const dynamic = "force-dynamic";

interface VencimientoRow {
  id: string;
  caso_id: string;
  tipo_evento: string;
  fecha_fin: string | null;
  completado: boolean;
  caso: {
    numero_siniestro: string;
    estado: string;
    asegurado: { nombre: string } | null;
    responsable: { nombre: string } | null;
  } | null;
}

function estadoBadgeClass(estado: string) {
  switch (estado) {
    case "cerrado":
      return "bg-emerald-100 text-emerald-700";
    case "baja_en_tramite":
      return "bg-brand-100 text-brand-700";
    case "iniciado":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export default async function PanelPage() {
  const supabase = createClient();

  const [{ data: casos, error: errorCasos }, { data: vencimientos, error: errorVenc }] =
    await Promise.all([
      supabase.from("casos").select("id, estado"),
      supabase
        .from("bitacora")
        .select(
          `
          id, caso_id, tipo_evento, fecha_fin, completado,
          caso:casos(numero_siniestro, estado, asegurado:asegurados(nombre), responsable:usuarios(nombre))
        `
        )
        .eq("completado", false)
        .not("fecha_fin", "is", null)
        .order("fecha_fin", { ascending: true })
        .limit(8)
    ]);

  const totalCasos = casos?.length ?? 0;
  const casosAbiertos = casos?.filter((c) => c.estado !== "cerrado").length ?? 0;
  const casosCerrados = totalCasos - casosAbiertos;

  const conteoPorEstado: Record<string, number> = {};
  for (const e of ESTADOS) conteoPorEstado[e.value] = 0;
  for (const c of (casos as Pick<Caso, "id" | "estado">[] | null) ?? []) {
    conteoPorEstado[c.estado] = (conteoPorEstado[c.estado] ?? 0) + 1;
  }
  const maxConteo = Math.max(1, ...Object.values(conteoPorEstado));

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Panel de control</h1>
        <p className="text-sm text-slate-500">
          Estado general de los casos y próximos vencimientos.
        </p>
      </div>

      {(errorCasos || errorVenc) && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">
          {errorCasos?.message || errorVenc?.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Casos totales" value={totalCasos} />
        <StatCard label="Casos abiertos" value={casosAbiertos} />
        <StatCard label="Casos cerrados" value={casosCerrados} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Casos por estado</h2>
          <div className="space-y-3">
            {ESTADOS.map((e) => {
              const cantidad = conteoPorEstado[e.value] ?? 0;
              const pct = Math.round((cantidad / maxConteo) * 100);
              return (
                <Link
                  key={e.value}
                  href={`/casos?estado=${e.value}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 group-hover:text-brand-600">
                      {e.label}
                    </span>
                    <span className="text-slate-500">{cantidad}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${cantidad === 0 ? 0 : Math.max(pct, 4)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-800">Próximos vencimientos</h2>
            <Link href="/agenda" className="text-sm text-brand-600 hover:underline">
              Ver agenda completa
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(vencimientos as unknown as VencimientoRow[] | null)?.map((v) => {
              const vencida =
                !!v.fecha_fin && new Date(v.fecha_fin + "T00:00:00") < hoy;
              return (
                <div key={v.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/casos/${v.caso_id}`}
                      className="text-brand-600 font-medium hover:underline text-sm"
                    >
                      {v.caso?.numero_siniestro ?? "Caso"}
                    </Link>
                    <p className="text-sm text-slate-700 truncate">{v.tipo_evento}</p>
                    <p className="text-xs text-slate-400">
                      {v.caso?.asegurado?.nombre} · {v.caso?.responsable?.nombre ?? "Sin responsable"}
                    </p>
                  </div>
                  {v.fecha_fin && (
                    <span
                      className={`badge shrink-0 ${
                        vencida
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {new Date(v.fecha_fin + "T00:00:00").toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
              );
            })}
            {vencimientos?.length === 0 && (
              <p className="text-sm text-slate-500 py-2">
                No hay vencimientos próximos cargados.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
