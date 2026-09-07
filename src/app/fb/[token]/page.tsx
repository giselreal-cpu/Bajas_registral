import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import InstallBanner from "@/components/InstallBanner";
import UploadForm from "./UploadForm";

export const dynamic = "force-dynamic";

// Mismo criterio que /g/[token]: el ícono instalado desde este enlace en
// Android tiene que volver a ESTE formulario, no al manifest general
// (start_url "/", que exige sesión) — ver src/lib/pwaManifest.ts.
export function generateMetadata({ params }: { params: { token: string } }): Metadata {
  return { manifest: `/api/manifest-formulario-baja/${params.token}` };
}

interface EventoFormularioBaja {
  id: string;
  caso_id: string;
  formulario_baja_nombre: string | null;
  caso: {
    numero_siniestro: string;
    aseguradora: { nombre: string } | null;
    vehiculo: { dominio: string; marca: string | null; modelo: string | null } | null;
  } | null;
}

export default async function EnlaceFormularioBajaPage({
  params
}: {
  params: { token: string };
}) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("bitacora")
    .select(
      `
      id,
      caso_id,
      formulario_baja_nombre,
      caso:casos(
        numero_siniestro,
        aseguradora:aseguradoras(nombre),
        vehiculo:vehiculos(dominio, marca, modelo)
      )
    `
    )
    .eq("token_formulario_baja", params.token)
    .eq("tipo_evento", "Formulario de Baja")
    .maybeSingle();

  const evento = data as unknown as EventoFormularioBaja | null;

  if (!evento || !evento.formulario_baja_nombre) {
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

  const { data: todosLosDocumentos } = await supabase
    .from("documentos")
    .select("id, nombre, url, categoria")
    .eq("caso_id", evento.caso_id)
    .order("created_at", { ascending: false });

  // La carpeta del dominio (imágenes, documentos para la compañía, o
  // cualquier link pegado) es lo que la persona necesita para completar
  // el formulario — se muestra aparte de lo que ya subió por este enlace.
  const documentosDelCaso = (todosLosDocumentos ?? []).filter(
    (d) => d.categoria !== "formulario_baja"
  );
  const formulariosCargados = (todosLosDocumentos ?? []).filter(
    (d) => d.categoria === "formulario_baja"
  );

  const conUrlFirmada = async (docs: typeof documentosDelCaso) =>
    Promise.all(
      docs.map(async (d) => ({
        ...d,
        url_firmada: await obtenerUrlFirmada(d.url)
      }))
    );

  const [documentosCaso, documentos] = await Promise.all([
    conUrlFirmada(documentosDelCaso),
    conUrlFirmada(formulariosCargados)
  ]);

  const caso = evento.caso;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Caso {caso?.numero_siniestro ?? "—"}
        </h1>
        <p className="text-sm text-slate-500">
          Hola {evento.formulario_baja_nombre}, acá podés cargar el formulario/04D completado
          para este caso.
        </p>
      </div>

      <InstallBanner />

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Datos del caso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="label">Aseguradora</div>
            <div className="text-slate-800">{caso?.aseguradora?.nombre ?? "—"}</div>
          </div>
          <div>
            <div className="label">Vehículo</div>
            <div className="text-slate-800 uppercase">
              {caso?.vehiculo?.dominio ?? "—"}
              <span className="normal-case">
                {caso?.vehiculo?.marca ? ` · ${caso.vehiculo.marca}` : ""}
                {caso?.vehiculo?.modelo ? ` ${caso.vehiculo.modelo}` : ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      {documentosCaso.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Documentación del caso</h2>
          <ul className="space-y-1 text-sm">
            {documentosCaso.map((d) => (
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

      {documentos.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Formulario/04D ya cargado</h2>
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
        <h2 className="font-medium text-slate-800 mb-3">Cargar el formulario/04D completado</h2>
        <UploadForm token={params.token} />
      </section>
    </div>
  );
}
