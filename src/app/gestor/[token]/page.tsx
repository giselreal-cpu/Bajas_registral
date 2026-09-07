import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import InstallBanner from "@/components/InstallBanner";
import { ESTADOS } from "@/types/database";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { token: string } }): Metadata {
  return { manifest: `/api/manifest-gestor-hub/${params.token}` };
}

interface CasoAsignado {
  id: string;
  numero_siniestro: string;
  estado: string;
  token_gestor: string;
  created_at: string;
  aseguradora: { nombre: string } | null;
  vehiculo: { dominio: string } | null;
  tipo_baja: { nombre: string } | null;
}

export default async function HubGestorPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data: gestor } = await supabase
    .from("gestores")
    .select("id, nombre")
    .eq("token_acceso", params.token)
    .maybeSingle();

  if (!gestor) {
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
      token_gestor,
      created_at,
      aseguradora:aseguradoras(nombre),
      vehiculo:vehiculos(dominio),
      tipo_baja:tipos_baja(nombre)
    `
    )
    .eq("gestor_id", gestor.id)
    .order("created_at", { ascending: false });

  const casos = (data ?? []) as unknown as CasoAsignado[];

  return (
    <div className="mv max-w-2xl mx-auto" style={{ background: "var(--mv-bg)" }}>
      <div className="mb-1">
        <div className="mv-label">{gestor.nombre} · gestor</div>
        <h1 className="mv-heading text-xl mt-1">Tus casos</h1>
      </div>
      <p className="text-sm mt-2" style={{ color: "var(--mv-neutral-700)" }}>
        Sin contraseña: el teléfono ya guarda tus enlaces. Cada caso que te asignen aparece acá.
      </p>

      <div className="my-5">
        <InstallBanner />
      </div>

      {casos.length === 0 ? (
        <div className="mv-card p-6 text-center text-sm" style={{ color: "var(--mv-neutral-600)" }}>
          Todavía no tenés casos asignados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {casos.map((caso) => (
            <Link key={caso.id} href={`/g/${caso.token_gestor}`} className="mv-card block p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mv-heading text-[15px]">{caso.numero_siniestro}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--mv-neutral-700)" }}>
                    {caso.aseguradora?.nombre ?? "—"}
                    {caso.vehiculo?.dominio ? ` · ${caso.vehiculo.dominio}` : ""}
                    {caso.tipo_baja?.nombre ? ` · ${caso.tipo_baja.nombre}` : ""}
                  </div>
                </div>
                <span className="mv-badge shrink-0">
                  {ESTADOS.find((e) => e.value === caso.estado)?.label ?? caso.estado}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="text-[11.5px] mt-5" style={{ color: "var(--mv-neutral-600)" }}>
        Si perdés el teléfono, el tramitador puede revocar el enlace desde el caso.
      </p>
    </div>
  );
}
