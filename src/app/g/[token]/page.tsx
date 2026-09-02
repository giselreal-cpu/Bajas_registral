import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import InstallBanner from "@/components/InstallBanner";
import UploadForm from "./UploadForm";
import ObservacionForm from "./ObservacionForm";

export const dynamic = "force-dynamic";

// El ícono instalado desde este enlace en Android tiene que volver siempre
// a ESTE caso (no al manifest general, cuyo start_url "/" exige sesión que
// el gestor no tiene) — ver src/lib/pwaManifest.ts.
export function generateMetadata({ params }: { params: { token: string } }): Metadata {
  return { manifest: `/api/manifest-gestor/${params.token}` };
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
  gestor: { nombre: string } | null;
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
      gestor:gestores(nombre)
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Caso {caso.numero_siniestro}</h1>
        <p className="text-sm text-slate-500">
          Hola {caso.gestor?.nombre ?? ""}, acá tenés los datos para gestionar este caso.
        </p>
      </div>

      <InstallBanner />

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Datos del caso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Campo label="Aseguradora">{caso.aseguradora?.nombre ?? "—"}</Campo>
          <Campo label="Tipo de Baja">{caso.tipo_baja?.nombre ?? "—"}</Campo>
          <Campo label="Vehículo">
            {caso.vehiculo?.dominio ?? "—"}
            {caso.vehiculo?.marca ? ` · ${caso.vehiculo.marca}` : ""}
            {caso.vehiculo?.modelo ? ` ${caso.vehiculo.modelo}` : ""}
          </Campo>
          <Campo label="Asegurado">{caso.asegurado?.nombre ?? "—"}</Campo>
          <Campo label="Contacto">{caso.asegurado?.telefono ?? "—"}</Campo>
          <Campo label="Dirección">
            {[caso.asegurado?.direccion, caso.asegurado?.localidad, caso.asegurado?.provincia]
              .filter(Boolean)
              .join(", ") || "—"}
          </Campo>
          <Campo label="Registro de radicación">
            {caso.registro
              ? `${caso.registro.numero}${caso.registro.seccional ? ` (${caso.registro.seccional})` : ""}${
                  caso.registro.provincia ? ` - ${caso.registro.provincia}` : ""
                }`
              : "Sin asignar todavía"}
          </Campo>
        </div>
      </section>

      {documentos.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Documentación adjunta</h2>
          <ul className="space-y-1 text-sm">
            {documentos.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url_firmada ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {d.nombre}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Cargar un archivo</h2>
        <UploadForm token={params.token} />
      </section>

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Agregar una observación</h2>
        <ObservacionForm token={params.token} />
      </section>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}
