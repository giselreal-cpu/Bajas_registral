import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import { calcularProgreso } from "@/lib/eventosBitacora";
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
    vehiculo: { dominio: string; marca: string | null; modelo: string | null } | null;
    tipo_baja: { nombre: string } | null;
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
        vehiculo:vehiculos(dominio, marca, modelo),
        tipo_baja:tipos_baja(nombre)
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

  const [{ data: todosLosDocumentos }, { data: eventosBitacora }] = await Promise.all([
    supabase
      .from("documentos")
      .select("id, nombre, url, categoria")
      .eq("caso_id", evento.caso_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bitacora")
      .select("tipo_evento, completado")
      .eq("caso_id", evento.caso_id)
  ]);

  const progreso = calcularProgreso(eventosBitacora ?? []);

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
  const yaCargado = documentos.length > 0;

  return (
    <div className="mv max-w-2xl mx-auto" style={{ background: "var(--mv-bg)" }}>
      <div className="mb-1">
        <div className="mv-label">Enlace de desarmadero · sin cuenta</div>
        <h1 className="mv-heading text-xl mt-1 tabular-nums">
          {caso?.vehiculo?.dominio ?? "—"} · {caso?.numero_siniestro ?? "—"}
        </h1>
      </div>
      <p className="text-sm mt-2 mb-4" style={{ color: "var(--mv-neutral-700)" }}>
        Hola {evento.formulario_baja_nombre}, acá podés seguir el caso y cargar el formulario/04D
        completado.
      </p>

      <div className="mb-5">
        <InstallBanner />
      </div>

      <div className="mv-label mb-1.5">Estado del trámite</div>
      <div className="mv-heading text-[26px] leading-tight" style={{ letterSpacing: "-0.02em" }}>
        {progreso.pasoActual ? progreso.pasoActual.label : "Cerrado"}
      </div>
      <p className="text-[12.5px] mt-1.5" style={{ color: "var(--mv-neutral-700)" }}>
        Paso {progreso.completados} de {progreso.total}
      </p>
      <div className="flex gap-[3px] mt-4 mb-1.5">
        {Array.from({ length: progreso.total }).map((_, i) => (
          <span
            key={i}
            className="flex-1 h-1.5"
            style={{ background: i < progreso.completados ? "var(--mv-accent)" : "var(--mv-neutral-300)" }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] uppercase tracking-wide" style={{ color: "var(--mv-neutral-600)" }}>
        <span>Ingreso</span>
        <span>Cierre</span>
      </div>

      {progreso.pasoActual && (
        <div className="mt-4" style={{ borderLeft: "2px solid var(--mv-accent)", paddingLeft: 14 }}>
          <div className="mv-label">Lo que sigue</div>
          <div className="mv-heading text-[17px] mt-0.5">{progreso.pasoActual.label}</div>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--mv-neutral-700)" }}>
            {progreso.motivoBloqueoActual ?? "Sin bloqueos pendientes."}
          </p>
        </div>
      )}

      <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
      <div className="mv-label mb-2">Datos del caso</div>
      <div className="mv-card px-3.5">
        <Campo label="Vehículo">
          {caso?.vehiculo?.dominio ?? "—"}
          {caso?.vehiculo?.marca ? ` · ${caso.vehiculo.marca}` : ""}
          {caso?.vehiculo?.modelo ? ` ${caso.vehiculo.modelo}` : ""}
        </Campo>
        <Campo label="Tipo de baja" ultimo>
          {caso?.tipo_baja?.nombre ?? "—"}
        </Campo>
      </div>

      {documentosCaso.length > 0 && (
        <>
          <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
          <div className="mv-label mb-2">Documentación del caso</div>
          <div className="mv-card px-3.5">
            {documentosCaso.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 py-3"
                style={i < documentosCaso.length - 1 ? { borderBottom: "1px solid var(--mv-divider)" } : undefined}
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
      <div className="mv-label mb-2">Cargar el formulario/04D completado</div>
      {yaCargado ? (
        <div className="mv-card p-3.5">
          <div className="mv-heading text-[15px]" style={{ color: "var(--mv-accent-700)" }}>
            04D cargado correctamente
          </div>
          <div className="text-[12.5px] mt-1" style={{ color: "var(--mv-neutral-700)" }}>
            {documentos[0].nombre}
          </div>
          <div className="mt-3">
            <UploadForm token={params.token} />
          </div>
        </div>
      ) : (
        <UploadForm token={params.token} />
      )}

      <p className="text-[11px] mt-4" style={{ color: "var(--mv-neutral-600)" }}>
        Este enlace muestra solo el seguimiento y la documentación del caso. No se muestran datos
        del asegurado ni comerciales.
      </p>
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
