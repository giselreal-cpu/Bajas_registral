import { createClient } from "@/lib/supabase/server";

// "Caja pesos" es la caja por defecto para todo movimiento marcado
// pagado/cobrado que no tenga una caja elegida explícitamente — así
// nada de lo que ya está efectivamente pagado o cobrado queda afuera
// del Libro de movimientos ni de Liquidez por no tener caja asignada.
export async function obtenerCajaPesosId(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data } = await supabase.from("cajas").select("id").eq("nombre", "Caja pesos").maybeSingle();
  return data?.id ?? null;
}
