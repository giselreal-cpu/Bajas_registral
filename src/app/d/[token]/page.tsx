import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import InstallBanner from "@/components/InstallBanner";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

export const dynamic = "force-dynamic";

// Mismo orden que el timeline mobile interno (BitacoraTimeline.tsx) —
// reordenado solo para mostrarlo como secuencia, sin tocar el
// catálogo compartido. "Observaciones" queda afuera a propósito: acá
// no se muestra ningún texto libre, ni de eventos comunes ni de
// observaciones sueltas, sean internas o no — el desarmadero solo ve
// que un paso se completó y cuándo.
const ORDEN_TIMELINE = [
  "ingreso_caso",
  "peticion_informes",
  "contacto_asegurado",
  "autorizacion_traslado",
  "asignacion_desarmadero",
  "traslado",
  "formulario_baja",
  "presentacion_baja",
  "envio_documentacion_cia",
  "baja_patentes",
  "cierre_caso"
];
const PASOS = ORDEN_TIMELINE.map((v) => TIPOS_EVENTO.find((t) => t.value === v)).filter(
  (t): t is NonNullable<typeof t> => !!t
);

export function generateMetadata({ params }: { params: { token: string } }): Metadata {
  return { manifest: `/api/manifest-desarmadero-hub/${params.token}` };
}

interface CasoParaDesarmadero {
  id: string;
  numero_siniestro: string;
  desarmadero_id: string | null;
  vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  registro: { numero: string; seccional: string | null; provincia: string | null } | null;
  tipo_baja: { nombre: string } | null;
}

interface EventoTracker {
  tipo_evento: string;
  completado: boolean;
  fecha_inicio: string;
}

interface DocumentoConUrl {
  id: string;
  nombre: string;
  url_firmada: string | null;
}

export default async function EnlaceDesarmaderoPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("casos")
    .select(
      `
      id,
      numero_siniestro,
      desarmadero_id,
      vehiculo:vehiculos(dominio, marca, modelo, anio),
      registro:registros_automotores(numero, seccional, provincia),
      tipo_baja:tipos_baja(nombre)
    `
    )
    .eq("token_desarmadero", params.token)
    .maybeSingle();

  const caso = data as unknown as CasoParaDesarmadero | null;

  if (!caso || !caso.desarmadero_id) {
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

  const { data: eventosRaw } = await supabase
    .from("bitacora")
    .select("tipo_evento, completado, fecha_inicio")
    .eq("caso_id", caso.id);

  const eventos = (eventosRaw ?? []) as EventoTracker[];
  const completados = PASOS.filter((p) => eventos.some((e) => e.tipo_evento === p.label && e.completado)).length;

  const { data: desarmadero } = await supabase
    .from("desarmaderos")
    .select("token_acceso")
    .eq("id", caso.desarmadero_id)
    .maybeSingle();

  // El desarmadero solo puede ver 5 tipos de documentación (informe de
  // dominio, fotos del vehículo, comprobantes de multas/patentes, y el
  // Anexo 04 de piezas RUDAC) — sin importar en qué categoría interna
  // esté archivado cada uno, salvo fotos y anexo04 que sí tienen su
  // propia categoría fija (imagen_dominio / anexo04_rudac).
  const { data: documentosRaw } = await supabase
    .from("documentos")
    .select("id, nombre, url, categoria")
    .eq("caso_id", caso.id)
    .order("created_at", { ascending: false });

  const todos = documentosRaw ?? [];
  const firmar = async (docs: typeof todos): Promise<DocumentoConUrl[]> =>
    Promise.all(
      docs.map(async (d) => ({ id: d.id, nombre: d.nombre, url_firmada: await obtenerUrlFirmada(d.url) }))
    );

  const documentacion = {
    informeDominio: await firmar(todos.filter((d) => normalizar(d.nombre).includes("informe de dominio"))),
    fotos: await firmar(todos.filter((d) => d.categoria === "imagen_dominio")),
    multas: await firmar(todos.filter((d) => normalizar(d.nombre).includes("multa"))),
    patentes: await firmar(todos.filter((d) => normalizar(d.nombre).includes("patente"))),
    anexo04: await firmar(todos.filter((d) => d.categoria === "anexo04_rudac"))
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Caso {caso.numero_siniestro}</h1>
        <p className="text-sm text-slate-500">Estado del trámite de este caso.</p>
      </div>

      {desarmadero?.token_acceso && (
        <Link
          href={`/desarmadero/${desarmadero.token_acceso}`}
          className="card p-3 flex items-center justify-between gap-2 hover:border-brand-400 text-sm"
        >
          <span className="text-slate-700">Ver todos tus casos y los formularios pendientes</span>
          <span className="text-brand-600 font-medium shrink-0">Ir →</span>
        </Link>
      )}

      <InstallBanner />

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Datos del caso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Campo label="Tipo de baja">{caso.tipo_baja?.nombre ?? "—"}</Campo>
          <Campo label="Vehículo">
            {caso.vehiculo?.dominio ?? "—"}
            {caso.vehiculo?.marca ? ` · ${caso.vehiculo.marca}` : ""}
            {caso.vehiculo?.modelo ? ` ${caso.vehiculo.modelo}` : ""}
            {caso.vehiculo?.anio ? ` (${caso.vehiculo.anio})` : ""}
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

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-800">Avance del trámite</h2>
          <span className="text-xs text-slate-400">
            {completados} de {PASOS.length}
          </span>
        </div>
        <div className="flex flex-col">
          {PASOS.map((paso, i) => {
            const ev = eventos.find((e) => e.tipo_evento === paso.label);
            const completado = !!ev?.completado;
            const esUltimo = i === PASOS.length - 1;
            return (
              <div key={paso.value} className="flex gap-3">
                <div className="flex flex-col items-center w-[18px] shrink-0">
                  <span
                    className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                      completado ? "bg-brand-600" : "bg-white border border-slate-300"
                    }`}
                  />
                  {!esUltimo && <span className="flex-1 w-px my-1 bg-slate-200" />}
                </div>
                <div className={`min-w-0 flex items-baseline justify-between gap-2 w-full ${esUltimo ? "pb-1" : "pb-4"}`}>
                  <span className={`text-sm ${completado ? "text-slate-800" : "text-slate-400"}`}>
                    {paso.label}
                  </span>
                  {ev && (
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {new Date(ev.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Documentación</h2>
        <div className="space-y-4">
          <GrupoDocumentos titulo="Informe de dominio" documentos={documentacion.informeDominio} />
          <GrupoDocumentos titulo="Fotos" documentos={documentacion.fotos} />
          <GrupoDocumentos titulo="Multas" documentos={documentacion.multas} />
          <GrupoDocumentos titulo="Patentes" documentos={documentacion.patentes} />
          <GrupoDocumentos titulo="Anexo 04 (Piezas RUDAC)" documentos={documentacion.anexo04} />
        </div>
      </section>
    </div>
  );
}

function GrupoDocumentos({ titulo, documentos }: { titulo: string; documentos: DocumentoConUrl[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500 mb-1">{titulo}</p>
      {documentos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin documentos todavía.</p>
      ) : (
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
      )}
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
