import { createClient } from "@/lib/supabase/server";
import { Moneda } from "@/types/database";

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

// Moneda de un movimiento = la de la caja donde efectivamente entró o
// salió esa plata (nunca se elige aparte) — sin caja asignada, se
// asume ARS (igual que el resto del esquema hoy). Se usa para que
// Panel/Análisis puedan separar sus totales por moneda, igual que ya
// hace Liquidez agrupando por caja.
export async function obtenerMonedaCaja(
  supabase: ReturnType<typeof createClient>,
  cajaId: string | null
): Promise<Moneda> {
  if (!cajaId) return "ARS";
  const { data } = await supabase.from("cajas").select("moneda").eq("id", cajaId).maybeSingle();
  return (data?.moneda as Moneda | undefined) ?? "ARS";
}
