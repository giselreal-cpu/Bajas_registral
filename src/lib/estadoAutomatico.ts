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
  "traslado_realizado",
  "baja_en_tramite",
  "presentado_en_registro",
  "documentacion_enviada",
  "cerrado"
];

// Qué evento de bitácora (por label, tal cual aparece en TIPOS_EVENTO)
// hace avanzar a qué estado del caso, una vez completado. Cada evento
// clave tiene su propio estado (uno a uno), salvo "Ingreso de caso" (ya
// arranca en "iniciado") y "Observaciones" (no representa un paso del
// proceso).
const EVENTO_A_ESTADO: Record<string, Estado> = {
  "Petición de Informes": "informes_solicitados",
  "Contacto con el asegurado": "en_verificacion",
  "Autorización de traslado": "autorizacion_traslado",
  "Asignación de desarmadero": "desarmadero_asignado",
  Traslado: "traslado_realizado",
  "Formulario de Baja": "baja_en_tramite",
  "Presentación de Baja": "presentado_en_registro",
  "Envío de documentación Cía": "documentacion_enviada",
  "Cierre de Caso": "cerrado"
};

// Se llama después de guardar un evento de bitácora completado. Si ese
// tipo de evento tiene un estado asociado y ese estado está más adelante
// que el actual del caso, actualiza casos.estado (y fecha_cierre si
// corresponde a "cerrado" y todavía no tenía una cargada).
export async function avanzarEstadoSiCorresponde(casoId: string, tipoEvento: string) {
  const nuevoEstado = EVENTO_A_ESTADO[tipoEvento];
  if (!nuevoEstado) {
    return { intentado: false, motivo: "El tipo de evento no tiene un estado asociado." };
  }

  const supabase = createClient();
  const { data: caso, error: errorLectura } = await supabase
    .from("casos")
    .select("estado, fecha_cierre")
    .eq("id", casoId)
    .maybeSingle();

  if (errorLectura || !caso) {
    return {
      intentado: false,
      motivo: `No se pudo leer el caso: ${errorLectura?.message ?? "no encontrado"}`
    };
  }

  const rankActual = ORDEN_ESTADOS.indexOf(caso.estado as Estado);
  const rankNuevo = ORDEN_ESTADOS.indexOf(nuevoEstado);
  if (rankNuevo <= rankActual) {
    return {
      intentado: false,
      motivo: `El estado actual ("${caso.estado}") ya está igual o más avanzado que "${nuevoEstado}".`
    };
  }

  const update: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === "cerrado" && !caso.fecha_cierre) {
    update.fecha_cierre = new Date().toISOString().slice(0, 10);
  }

  const { data: actualizado, error } = await supabase
    .from("casos")
    .update(update)
    .eq("id", casoId)
    .select("id, estado");

  if (error) {
    return { intentado: true, ok: false, motivo: `Error al actualizar: ${error.message}` };
  }

  if (!actualizado || actualizado.length === 0) {
    return {
      intentado: true,
      ok: false,
      motivo: "El UPDATE no afectó ninguna fila (probablemente bloqueado por RLS)."
    };
  }

  return { intentado: true, ok: true, nuevoEstado: actualizado[0].estado };
}
