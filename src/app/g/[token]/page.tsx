import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import InstallBanner from "@/components/InstallBanner";
import UploadForm from "./UploadForm";
import ObservacionForm from "./ObservacionForm";

export const dynamic = "force-dynamic";

// El ícono instalado desde acá tiene que volver siempre al listado
// completo de asignaciones del gestor (no a este caso puntual, y menos
// al manifest general, cuyo start_url "/" exige sesión que el gestor no
// tiene) — por eso resuelve el token_acceso del gestor dueño de este
// caso y usa el manifest del hub. Ver src/lib/pwaManifest.ts.
export async function generateMetadata({
  params
}: {
  params: { token: string };
}): Promise<Metadata> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("casos")
    .select("gestor:gestores(token_acceso)")
    .eq("token_gestor", params.token)
    .maybeSingle();

  const tokenAcceso = (data?.gestor as unknown as { token_acceso: string } | null)?.token_acceso;
  if (!tokenAcceso) return {};
  return { manifest: `/api/manifest-gestor-hub/${tokenAcceso}` };
}

interface CasoResumenGestor {
  id: string;
  numero_siniestro: string;
  gestor_id: string | null;
  aseguradora: { nombre: string } | null;
  asegurado: {
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    localidad: string | null;
    provincia: string | null;
  } | null;
  vehiculo: { dominio: string; marca: string | null; modelo: string | null } | null;
  registro: { numero: string; seccional: string | null; provincia: string | null } | null;
  tipo_baja: { nombre: string } | null;
  gestor: { nombre: string; token_acceso: string } | null;
}

export default async function EnlaceGestorPage({
  params
}: {
  params: { token: string };
}) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("casos")
    .select(
      `
      id,
      numero_siniestro,
      gestor_id,
      aseguradora:aseguradoras(nombre),
      asegurado:asegurados(nombre, telefono, direccion, localidad, provincia),
      vehiculo:vehiculos(dominio, marca, modelo),
      registro:registros_automotores(numero, seccional, provincia),
      tipo_baja:tipos_baja(nombre),
      gestor:gestores(nombre, token_acceso)
    `
    )
    .eq("token_gestor", params.token)
    .maybeSingle();

  const caso = data as unknown as CasoResumenGestor | null;

  if (!caso || !caso.gestor_id) {
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

  const { data: documentosRaw } = await supabase
    .from("documentos")
    .select("id, nombre, url")
    .eq("caso_id", caso.id)
    .order("created_at", { ascending: false });

  const documentos = await Promise.all(
    (documentosRaw ?? []).map(async (d) => ({
      ...d,
      url_firmada: await obtenerUrlFirmada(d.url)
    }))
  );

  const direccion = [caso.asegurado?.direccion, caso.asegurado?.localidad, caso.asegurado?.provincia]
    .filter(Boolean)
    .join(", ");
  const telefono = caso.asegurado?.telefono?.replace(/[^\d+]/g, "");

  return (
    <div className="mv max-w-2xl mx-auto" style={{ background: "var(--mv-bg)" }}>
      <div className="mb-1">
        <div className="mv-label">Enlace de gestor · sin cuenta</div>
        <h1 className="mv-heading text-xl mt-1 tabular-nums">{caso.numero_siniestro}</h1>
      </div>
      <p className="text-sm mt-2" style={{ color: "var(--mv-neutral-700)" }}>
        Hola {caso.gestor?.nombre ?? ""}, acá tenés los datos para gestionar este caso.
      </p>
      {caso.gestor?.token_acceso && (
        <Link
          href={`/gestor/${caso.gestor.token_acceso}`}
          className="text-sm underline underline-offset-4"
          style={{ color: "var(--mv-accent-700)" }}
        >
          Ver todas mis asignaciones →
        </Link>
      )}

      <div className="my-5">
        <InstallBanner />
      </div>

      <div className="mv-label mb-2">Datos del caso</div>
      <div className="mv-card px-3.5">
        <Campo label="Aseguradora">{caso.aseguradora?.nombre ?? "—"}</Campo>
        <Campo label="Tipo de Baja">{caso.tipo_baja?.nombre ?? "—"}</Campo>
        <Campo label="Vehículo">
          {caso.vehiculo?.dominio ?? "—"}
          {caso.vehiculo?.marca ? ` · ${caso.vehiculo.marca}` : ""}
          {caso.vehiculo?.modelo ? ` ${caso.vehiculo.modelo}` : ""}
        </Campo>
        <Campo label="Asegurado">{caso.asegurado?.nombre ?? "—"}</Campo>
        <Campo label="Contacto">{caso.asegurado?.telefono ?? "—"}</Campo>
        <Campo label="Dirección">{direccion || "—"}</Campo>
        <Campo label="Registro de radicación" ultimo>
          {caso.registro
            ? `${caso.registro.numero}${caso.registro.seccional ? ` (${caso.registro.seccional})` : ""}${
                caso.registro.provincia ? ` - ${caso.registro.provincia}` : ""
              }`
            : "Sin asignar todavía"}
        </Campo>
      </div>

      <div className="flex gap-2.5 mt-3">
        <a
          href={telefono ? `tel:${telefono}` : undefined}
          aria-disabled={!telefono}
          className="mv-btn mv-btn-primary flex-1"
          style={{ minHeight: 46, opacity: telefono ? 1 : 0.5, pointerEvents: telefono ? "auto" : "none" }}
        >
          Llamar
        </a>
        <a
          href={direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}` : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!direccion}
          className="mv-btn mv-btn-secondary flex-1"
          style={{ minHeight: 46, opacity: direccion ? 1 : 0.5, pointerEvents: direccion ? "auto" : "none" }}
        >
          Cómo llegar
        </a>
      </div>

      {documentos.length > 0 && (
        <>
          <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
          <div className="mv-label mb-2">Documentación adjunta</div>
          <div className="mv-card px-3.5">
            {documentos.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 py-3"
                style={i < documentos.length - 1 ? { borderBottom: "1px solid var(--mv-divider)" } : undefined}
              >
                <a
                  href={d.url_firmada ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13.5px] truncate underline underline-offset-4"
                  style={{ color: "var(--mv-accent-700)" }}
                >
                  {d.nombre}
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
      <div className="mv-label mb-2">Cargar un archivo</div>
      <UploadForm token={params.token} />

      <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
      <div className="mv-label mb-2">Agregar una observación</div>
      <ObservacionForm token={params.token} />
    </div>
  );
}

function Campo({
  label,
  children,
  ultimo
}: {
  label: string;
  children: React.ReactNode;
  ultimo?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3.5 py-3"
      style={ultimo ? undefined : { borderBottom: "1px solid var(--mv-divider)" }}
    >
      <span className="mv-label shrink-0">{label}</span>
      <span className="text-[13.5px] text-right">{children}</span>
    </div>
  );
}
