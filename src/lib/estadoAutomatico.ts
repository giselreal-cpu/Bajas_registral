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

// Eventos que empujan el estado con solo existir en la bitácora (estén o
// no completados) — representan un paso que ya arrancó y del que se está
// esperando una respuesta ("Petición de Informes" = ya los pedimos,
// estamos esperando; "Contacto con el asegurado" = ya lo estamos
// contactando/verificando).
const EVENTO_EN_PROGRESO_A_ESTADO: Record<string, Estado> = {
  "Petición de Informes": "informes_solicitados",
  "Contacto con el asegurado": "en_verificacion"
};

// Eventos que solo empujan el estado una vez COMPLETADOS — representan un
// hito ya conseguido (autorización obtenida, desarmadero asignado, unidad
// trasladada, etc.), no algo que esté en curso.
const EVENTO_COMPLETADO_A_ESTADO: Record<string, Estado> = {
  "Autorización de traslado": "autorizacion_traslado",
  "Asignación de desarmadero": "desarmadero_asignado",
  Traslado: "traslado_realizado",
  "Formulario de Baja": "baja_en_tramite",
  "Presentación de Baja": "presentado_en_registro",
  "Envío de documentación Cía": "documentacion_enviada",
  "Cierre de Caso": "cerrado"
};

// Se llama después de cualquier alta/edición de un evento de bitácora.
// Recalcula el estado del caso desde CERO, mirando todos sus eventos
// (no solo el que se acaba de tocar), y lo deja en el más avanzado que
// corresponda según lo ya iniciado/completado. Nunca retrocede un estado
// que ya estuviera más adelante (incluyendo uno puesto a mano).
export async function recalcularEstado(casoId: string) {
  const supabase = createClient();

  const [{ data: caso, error: errorCaso }, { data: eventos, error: errorEventos }] =
    await Promise.all([
      supabase.from("casos").select("estado, fecha_cierre").eq("id", casoId).maybeSingle(),
      supabase.from("bitacora").select("tipo_evento, completado").eq("caso_id", casoId)
    ]);

  if (errorCaso || !caso) {
    return {
      intentado: false,
      motivo: `No se pudo leer el caso: ${errorCaso?.message ?? "no encontrado"}`
    };
  }
  if (errorEventos) {
    return { intentado: false, motivo: `No se pudieron leer los eventos: ${errorEventos.message}` };
  }

  const rankActual = ORDEN_ESTADOS.indexOf(caso.estado as Estado);
  let mejorRank = rankActual;
  let mejorEstado = caso.estado as Estado;

  for (const ev of eventos ?? []) {
    const estadoEnProgreso = EVENTO_EN_PROGRESO_A_ESTADO[ev.tipo_evento];
    if (estadoEnProgreso) {
      const rank = ORDEN_ESTADOS.indexOf(estadoEnProgreso);
      if (rank > mejorRank) {
        mejorRank = rank;
        mejorEstado = estadoEnProgreso;
      }
    }

    if (ev.completado) {
      const estadoCompletado = EVENTO_COMPLETADO_A_ESTADO[ev.tipo_evento];
      if (estadoCompletado) {
        const rank = ORDEN_ESTADOS.indexOf(estadoCompletado);
        if (rank > mejorRank) {
          mejorRank = rank;
          mejorEstado = estadoCompletado;
        }
      }
    }
  }

  if (mejorRank <= rankActual) {
    return {
      intentado: false,
      motivo: `El estado actual ("${caso.estado}") ya está igual o más avanzado que lo que sugiere la bitácora.`
    };
  }

  const update: Record<string, unknown> = { estado: mejorEstado };
  if (mejorEstado === "cerrado" && !caso.fecha_cierre) {
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

// Empuja el estado del caso hasta `estadoMinimo` si eso representa un
// avance real (nunca lo retrocede). A diferencia de recalcularEstado, esta
// no mira la bitácora: se usa para acciones puntuales del caso que por sí
// solas implican que se llegó a cierta etapa (por ejemplo, asignar un
// gestor de campo implica que ya se está en la etapa de presentación de
// la baja en el registro).
export async function avanzarEstadoAlMenosHasta(casoId: string, estadoMinimo: Estado) {
  const supabase = createClient();

  const { data: caso, error: errorCaso } = await supabase
    .from("casos")
    .select("estado, fecha_cierre")
    .eq("id", casoId)
    .maybeSingle();

  if (errorCaso || !caso) return null;

  const rankActual = ORDEN_ESTADOS.indexOf(caso.estado as Estado);
  const rankMinimo = ORDEN_ESTADOS.indexOf(estadoMinimo);
  if (rankMinimo <= rankActual) return null;

  const update: Record<string, unknown> = { estado: estadoMinimo };
  if (estadoMinimo === "cerrado" && !caso.fecha_cierre) {
    update.fecha_cierre = new Date().toISOString().slice(0, 10);
  }

  const { data: actualizado } = await supabase
    .from("casos")
    .update(update)
    .eq("id", casoId)
    .select("estado, fecha_cierre")
    .maybeSingle();

  return actualizado;
}
