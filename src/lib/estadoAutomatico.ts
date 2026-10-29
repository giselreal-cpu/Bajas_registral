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
  "gestor_asignado",
  "presentado_en_registro",
  "documentacion_enviada",
  "baja_patentes_pendiente",
  "cierre_pendiente",
  "cerrado"
];

// Eventos que empujan el estado con solo existir en la bitácora (estén o
// no completados) — representan un paso que ya arrancó y del que se está
// esperando una respuesta ("Petición de Informes" = ya los pedimos,
// estamos esperando; "Contacto con el asegurado" = ya lo estamos
// contactando/verificando; "Baja de Patentes" = se cargó el trámite y
// está pendiente de resolverse).
const EVENTO_EN_PROGRESO_A_ESTADO: Record<string, Estado> = {
  "Petición de Informes": "informes_solicitados",
  "Contacto con el asegurado": "en_verificacion",
  "Revisión de documentación": "en_verificacion",
  "Baja de Patentes": "baja_patentes_pendiente"
};

// Eventos que solo empujan el estado una vez COMPLETADOS — representan un
// hito ya conseguido (autorización obtenida, desarmadero asignado, unidad
// trasladada, etc.), no algo que esté en curso. Solo "Cierre de Caso"
// puede llevar el estado a "cerrado" — ese evento sí tiene gating real
// (motivoBloqueo en eventosBitacora.ts exige que estén completados
// Petición de Informes, Autorización de traslado, Traslado, Formulario
// de Baja, Presentación de Baja y Envío de documentación Cía). "Baja de
// Patentes" NO debe cerrar el caso por sí sola: es un trámite aparte
// (patentes municipales) que puede completarse sin que el resto del
// proceso de baja registral haya terminado.
const EVENTO_COMPLETADO_A_ESTADO: Record<string, Estado> = {
  "Autorización de traslado": "autorizacion_traslado",
  "Asignación de desarmadero": "desarmadero_asignado",
  Traslado: "traslado_realizado",
  "Formulario de Baja": "baja_en_tramite",
  "Presentación de Baja": "presentado_en_registro",
  "Envío de documentación Cía": "documentacion_enviada",
  // Con la baja de patentes ya resuelta, lo único que falta es cerrar el
  // caso: el estado pasa de "Baja de Patentes Pendiente" a "Cierre de Caso
  // Pendiente" (sigue sin cerrar el caso por sí sola).
  "Baja de Patentes": "cierre_pendiente",
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
      supabase.from("bitacora").select("tipo_evento, completado, fecha_fin").eq("caso_id", casoId)
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

  // Si el caso queda (o ya estaba) "cerrado" y todavía no tiene
  // fecha_cierre, la recuperamos del propio evento "Cierre de Caso" de
  // la bitácora en vez de null para siempre o la fecha de "ahora" — esto
  // puede pasar con casos que llegaron a "cerrado" por una vía que no
  // dejó cargada la fecha (edición manual del estado, datos viejos,
  // etc.), y antes quedaban estancados: como el estado ya no "avanzaba",
  // nunca se volvía a intentar completar fecha_cierre.
  const estadoFinal = mejorRank > rankActual ? mejorEstado : (caso.estado as Estado);
  let fechaCierreFaltante: string | null = null;
  if (estadoFinal === "cerrado" && !caso.fecha_cierre) {
    const eventoCierre = (eventos ?? []).find(
      (ev) => ev.tipo_evento === "Cierre de Caso" && ev.completado
    );
    fechaCierreFaltante = eventoCierre?.fecha_fin ?? new Date().toISOString().slice(0, 10);
  }

  if (mejorRank <= rankActual && !fechaCierreFaltante) {
    return {
      intentado: false,
      motivo: `El estado actual ("${caso.estado}") ya está igual o más avanzado que lo que sugiere la bitácora.`
    };
  }

  const update: Record<string, unknown> = {};
  if (mejorRank > rankActual) update.estado = mejorEstado;
  if (fechaCierreFaltante) update.fecha_cierre = fechaCierreFaltante;

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

// Estado más avanzado que sugiere la bitácora, partiendo desde cero (sin
// tener en cuenta el estado actual del caso).
function estadoSugeridoPorBitacora(
  eventos: { tipo_evento: string; completado: boolean }[]
): Estado {
  let mejorRank = 0;
  let mejorEstado: Estado = ORDEN_ESTADOS[0];
  for (const ev of eventos) {
    const candidatos: Estado[] = [];
    if (EVENTO_EN_PROGRESO_A_ESTADO[ev.tipo_evento]) candidatos.push(EVENTO_EN_PROGRESO_A_ESTADO[ev.tipo_evento]);
    if (ev.completado && EVENTO_COMPLETADO_A_ESTADO[ev.tipo_evento]) {
      candidatos.push(EVENTO_COMPLETADO_A_ESTADO[ev.tipo_evento]);
    }
    for (const c of candidatos) {
      const rank = ORDEN_ESTADOS.indexOf(c);
      if (rank > mejorRank) {
        mejorRank = rank;
        mejorEstado = c;
      }
    }
  }
  return mejorEstado;
}

// Se usa cuando a un caso se le SACA el gestor de campo: "Gestor Asignado"
// solo lo había puesto la asignación, así que al quitarla el estado vuelve
// al que corresponde según la bitácora. Si el caso ya estaba en otro estado
// (por ejemplo presentado en el registro) no se toca, y nunca baja de un
// estado que la bitácora ya justifique.
export async function revertirEstadoGestorAsignado(casoId: string) {
  const supabase = createClient();
  const [{ data: caso }, { data: eventos }] = await Promise.all([
    supabase.from("casos").select("estado").eq("id", casoId).maybeSingle(),
    supabase.from("bitacora").select("tipo_evento, completado").eq("caso_id", casoId)
  ]);
  if (!caso || caso.estado !== "gestor_asignado") return null;

  const sugerido = estadoSugeridoPorBitacora(eventos ?? []);
  if (ORDEN_ESTADOS.indexOf(sugerido) >= ORDEN_ESTADOS.indexOf("gestor_asignado")) return null;

  const { data: actualizado } = await supabase
    .from("casos")
    .update({ estado: sugerido })
    .eq("id", casoId)
    .select("estado")
    .maybeSingle();
  return actualizado;
}

// Un caso solo puede estar "cerrado" si su evento "Cierre de Caso" está
// completado. Si ese evento vuelve a quedar pendiente (o se elimina), el
// estado nunca retrocedía solo y el caso seguía figurando cerrado: acá se
// reabre — vuelve al estado que indica la bitácora y se limpia la fecha de
// cierre. Se llama después de desmarcar o borrar un "Cierre de Caso".
export async function reabrirSiCierreNoCompletado(casoId: string) {
  const supabase = createClient();
  const [{ data: caso }, { data: eventos }] = await Promise.all([
    supabase.from("casos").select("estado").eq("id", casoId).maybeSingle(),
    supabase.from("bitacora").select("tipo_evento, completado").eq("caso_id", casoId)
  ]);
  if (!caso || caso.estado !== "cerrado") return null;
  if ((eventos ?? []).some((e) => e.tipo_evento === "Cierre de Caso" && e.completado)) return null;

  const sugerido = estadoSugeridoPorBitacora(eventos ?? []);
  const { data: actualizado } = await supabase
    .from("casos")
    .update({ estado: sugerido, fecha_cierre: null })
    .eq("id", casoId)
    .select("estado")
    .maybeSingle();
  return actualizado;
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
