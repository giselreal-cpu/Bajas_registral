import type { SupabaseClient } from "@supabase/supabase-js";

// Casos anulados (ver migración 0078). Se consulta aparte y de forma
// tolerante: si las columnas todavía no existen, devuelve vacío y el resto de
// la app sigue andando.
export interface CasoAnulado {
  id: string;
  anulado_motivo: string | null;
}

export async function obtenerCasosAnulados(supabase: SupabaseClient): Promise<CasoAnulado[]> {
  const { data, error } = await supabase.from("casos").select("id, anulado_motivo").eq("anulado", true);
  return error ? [] : ((data ?? []) as CasoAnulado[]);
}

export async function obtenerIdsAnulados(supabase: SupabaseClient): Promise<Set<string>> {
  return new Set((await obtenerCasosAnulados(supabase)).map((c) => c.id));
}
