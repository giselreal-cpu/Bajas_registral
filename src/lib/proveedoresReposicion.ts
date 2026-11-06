import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProveedorReposicion } from "@/types/database";

// Trae el proveedor de reposición asignado a un caso. Se consulta aparte
// (en vez de embeberlo en el select del caso) para que, si la tabla todavía
// no existe, la ficha del caso siga funcionando.
export async function obtenerProveedorReposicion(
  supabase: SupabaseClient,
  proveedorId: string | null | undefined
): Promise<ProveedorReposicion | null> {
  if (!proveedorId) return null;
  const { data, error } = await supabase
    .from("proveedores_reposicion")
    .select("id, nombre, emails, telefono")
    .eq("id", proveedorId)
    .maybeSingle();
  return error ? null : (data as ProveedorReposicion | null);
}
