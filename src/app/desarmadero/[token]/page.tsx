import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import InstallBanner from "@/components/InstallBanner";
import { ESTADOS } from "@/types/database";
import { estadoBadgeClass } from "@/lib/estadoBadge";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { token: string } }): Metadata {
  return { manifest: `/api/manifest-desarmadero-hub/${params.token}` };
}

interface CasoAsignado {
  id: string;
  numero_siniestro: string;
  estado: string;
  token_desarmadero: string;
  created_at: string;
  vehiculo: { dominio: string } | null;
  tipo_baja: { nombre: string } | null;
}

interface CasoPendienteFormulario {
  id: string;
  fecha_inicio: string;
  caso: {
    numero_siniestro: string;
    token_desarmadero: string;
    vehiculo: { dominio: string } | null;
  } | null;
}

export default async function HubDesarmaderoPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: desarmadero } = await supabase
    .from("desarmaderos")
    .select("id, nombre")
    .eq("token_acceso", params.token)
    .maybeSingle();

  if (!desarmadero) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Enlace inválido</h1>
        <p className="text-sm text-slate-500">
          Este enlace no es válido o ya no está activo. Pedile a quien te lo
          compartió que te envíe uno nuevo.
        </p>
      </div>
    );
  }

  const { data } = await supabase
    .from("casos")
    .select(
      `
      id,
      numero_siniestro,
      estado,
      token_desarmadero,
      created_at,
      vehiculo:vehiculos(dominio),
      tipo_baja:tipos_baja(nombre)
    `
    )
    .eq("desarmadero_id", desarmadero.id)
    .order("created_at", { ascending: false });

  const casos = (data ?? []) as unknown as CasoAsignado[];

  // Formulario de Baja ya iniciado (existe el evento en bitácora) pero
  // todavía no marcado como completado, para los casos de este desarmadero.
  const { data: pendientesRaw } = await supabase
    .from("bitacora")
    .select(
      `
      id,
      fecha_inicio,
      caso:casos!inner(numero_siniestro, token_desarmadero, desarmadero_id, vehiculo:vehiculos(dominio))
    `
    )
    .eq("tipo_evento", "Formulario de Baja")
    .eq("completado", false)
    .eq("caso.desarmadero_id", desarmadero.id)
    .order("fecha_inicio", { ascending: true });

  const pendientesFormulario = (pendientesRaw ?? []) as unknown as CasoPendienteFormulario[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tus casos asignados</h1>
        <p className="text-sm text-slate-500">
          Hola, acá está el estado de todos los casos que se les asignaron a {desarmadero.nombre}.
        </p>
      </div>

      <InstallBanner />

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-2">
          Formulario de Baja iniciado, sin completar ({pendientesFormulario.length})
        </h2>
        {pendientesFormulario.length === 0 ? (
          <p className="text-sm text-slate-500">No hay ninguno pendiente.</p>
        ) : (
          <div className="space-y-2">
            {pendientesFormulario.map((p) => (
              <Link
                key={p.id}
                href={`/d/${p.caso?.token_desarmadero}`}
                className="block rounded-lg border border-slate-200 p-3 hover:border-brand-400"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">Caso {p.caso?.numero_siniestro ?? "—"}</div>
                    <div className="text-sm text-slate-500">{p.caso?.vehiculo?.dominio ?? "—"}</div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    Iniciado {new Date(p.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <details className="card p-4" open>
        <summary className="font-medium text-slate-800 cursor-pointer">
          Todos tus casos asignados ({casos.length})
        </summary>
        {casos.length === 0 ? (
          <p className="text-sm text-slate-500 mt-3">Todavía no hay casos asignados.</p>
        ) : (
          <div className="space-y-3 mt-3">
            {casos.map((caso) => (
              <Link
                key={caso.id}
                href={`/d/${caso.token_desarmadero}`}
                className="card p-4 block hover:border-brand-400"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">Caso {caso.numero_siniestro}</div>
                    <div className="text-sm text-slate-500">
                      {caso.vehiculo?.dominio ?? "—"}
                      {caso.tipo_baja?.nombre ? ` · ${caso.tipo_baja.nombre}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${estadoBadgeClass(
                      caso.estado
                    )}`}
                  >
                    {ESTADOS.find((e) => e.value === caso.estado)?.label ?? caso.estado}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
