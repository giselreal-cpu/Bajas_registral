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
  aseguradora: { nombre: string } | null;
  vehiculo: { dominio: string } | null;
  tipo_baja: { nombre: string } | null;
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
      aseguradora:aseguradoras(nombre),
      vehiculo:vehiculos(dominio),
      tipo_baja:tipos_baja(nombre)
    `
    )
    .eq("desarmadero_id", desarmadero.id)
    .order("created_at", { ascending: false });

  const casos = (data ?? []) as unknown as CasoAsignado[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tus casos asignados</h1>
        <p className="text-sm text-slate-500">
          Hola, acá está el estado de todos los casos que se les asignaron a {desarmadero.nombre}.
        </p>
      </div>

      <InstallBanner />

      {casos.length === 0 ? (
        <section className="card p-4 text-sm text-slate-500">
          Todavía no hay casos asignados.
        </section>
      ) : (
        <div className="space-y-3">
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
                    {caso.aseguradora?.nombre ?? "—"}
                    {caso.vehiculo?.dominio ? ` · ${caso.vehiculo.dominio}` : ""}
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
    </div>
  );
}
