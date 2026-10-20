import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENTOS_SOLO_INFORMES } from "@/lib/eventosBitacora";

// Los trámites de tipo de baja "Solo Informes" no pasan por gestor,
// traslado, formularios ni presentación en el registro: su bitácora es
// siempre la misma secuencia corta (ver EVENTOS_SOLO_INFORMES). Se crean
// los eventos pendientes al alta del caso (o cuando se le cambia el tipo de
// baja a "Solo Informes") para que el equipo vaya tildándolos.

// Crea, como pendientes, los eventos de la secuencia que todavía no existan
// en la bitácora del caso. Devuelve cuántos creó.
export async function asegurarEventosSoloInformes(
  supabase: SupabaseClient,
  casoId: string,
  creadoPor: string | null
): Promise<number> {
  const { data: existentes } = await supabase.from("bitacora").select("tipo_evento").eq("caso_id", casoId);
  const yaCargados = new Set((existentes ?? []).map((e: { tipo_evento: string }) => e.tipo_evento));

  const faltantes = EVENTOS_SOLO_INFORMES.filter((t) => !yaCargados.has(t));
  if (faltantes.length === 0) return 0;

  const { error } = await supabase.from("bitacora").insert(
    faltantes.map((tipo_evento) => ({
      caso_id: casoId,
      tipo_evento,
      completado: false,
      creado_por: creadoPor
    }))
  );
  return error ? 0 : faltantes.length;
}

// Nombre del tipo de baja de un caso (para validar prerrequisitos de la
// bitácora según el tipo de trámite).
export async function nombreTipoBajaDeCaso(supabase: SupabaseClient, casoId: string): Promise<string | null> {
  const { data } = await supabase
    .from("casos")
    .select("tipo_baja:tipos_baja(nombre)")
    .eq("id", casoId)
    .maybeSingle();
  const tipo = (data as unknown as { tipo_baja: { nombre: string } | null } | null)?.tipo_baja;
  return tipo?.nombre ?? null;
}
