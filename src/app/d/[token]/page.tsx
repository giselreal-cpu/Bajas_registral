import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import InstallBanner from "@/components/InstallBanner";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";

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
  aseguradora: { nombre: string } | null;
  vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  registro: { numero: string; seccional: string | null; provincia: string | null } | null;
  tipo_baja: { nombre: string } | null;
}

interface EventoTracker {
  tipo_evento: string;
  completado: boolean;
  fecha_inicio: string;
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
      aseguradora:aseguradoras(nombre),
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Caso {caso.numero_siniestro}</h1>
        <p className="text-sm text-slate-500">Estado del trámite de este caso.</p>
      </div>

      <InstallBanner />

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Datos del caso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Campo label="Aseguradora">{caso.aseguradora?.nombre ?? "—"}</Campo>
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
