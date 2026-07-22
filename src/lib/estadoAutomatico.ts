import { createClient } from "@/lib/supabase/server";
import { Estado } from "@/types/database";

// Orden de avance del flujo de negocio (ver CLAUDE.md). Un evento nunca
// hace retroceder el estado, solo lo adelanta si corresponde a un paso
// más avanzado que el actual.
const ORDEN_ESTADOS: Estado[] = [
  "iniciado",
  "informes_solicitados",
  "en_verificacion",
  "autorizacion_traslado",
  "desarmadero_asignado",
  "baja_en_tramite",
  "cerrado"
];

// Qué evento de bitácora (por label, tal cual aparece en TIPOS_EVENTO)
// hace avanzar a qué estado del caso, una vez completado.
const EVENTO_A_ESTADO: Record<string, Estado> = {
  "Petición de Informes": "informes_solicitados",
  "Contacto con el asegurado": "en_verificacion",
  "Autorización de traslado": "autorizacion_traslado",
  "Asignación de desarmadero": "desarmadero_asignado",
  "Formulario de Baja": "baja_en_tramite",
  "Presentación de Baja": "baja_en_tramite",
  "Cierre de Caso": "cerrado"
};

// Se llama después de guardar un evento de bitácora completado. Si ese
// tipo de evento tiene un estado asociado y ese estado está más adelante
// que el actual del caso, actualiza casos.estado (y fecha_cierre si
// corresponde a "cerrado" y todavía no tenía una cargada).
export async function avanzarEstadoSiCorresponde(casoId: string, tipoEvento: string) {
  const nuevoEstado = EVENTO_A_ESTADO[tipoEvento];
  if (!nuevoEstado) return;

  const supabase = createClient();
  const { data: caso } = await supabase
    .from("casos")
    .select("estado, fecha_cierre")
    .eq("id", casoId)
    .maybeSingle();

  if (!caso) return;

  const rankActual = ORDEN_ESTADOS.indexOf(caso.estado as Estado);
  const rankNuevo = ORDEN_ESTADOS.indexOf(nuevoEstado);
  if (rankNuevo <= rankActual) return;

  const update: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === "cerrado" && !caso.fecha_cierre) {
    update.fecha_cierre = new Date().toISOString().slice(0, 10);
  }

  const { data: actualizado, error } = await supabase
    .from("casos")
    .update(update)
    .eq("id", casoId)
    .select("id");

  if (error) {
    // eslint-disable-next-line no-console
    console.error("No se pudo avanzar el estado del caso automáticamente:", error.message, {
      casoId,
      tipoEvento,
      nuevoEstado
    });
    return;
  }

  if (!actualizado || actualizado.length === 0) {
    // El pedido "salió bien" pero no tocó ninguna fila (por ejemplo,
    // bloqueado en silencio por RLS). Lo dejamos bien visible en los logs.
    // eslint-disable-next-line no-console
    console.error(
      "avanzarEstadoSiCorresponde: el UPDATE no afectó ninguna fila (posible bloqueo de RLS).",
      { casoId, tipoEvento, nuevoEstado }
    );
  }
}
