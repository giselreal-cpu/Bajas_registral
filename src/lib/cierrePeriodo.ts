import { createClient } from "@/lib/supabase/server";

// Un mes cerrado bloquea crear/editar/anular/borrar cualquier
// movimiento financiero con fecha dentro de ese mes — ver
// 0051_cierres_mensuales.sql. `fecha` viene en formato AAAA-MM-DD.
export async function periodoCerrado(
  supabase: ReturnType<typeof createClient>,
  fecha: string
): Promise<boolean> {
  const mes = fecha.slice(0, 7);
  const { data } = await supabase.from("cierres_mensuales").select("id").eq("mes", mes).maybeSingle();
  return !!data;
}

export const ERROR_PERIODO_CERRADO =
  "Ese período ya está cerrado — un administrador tiene que reabrirlo antes de poder cargar o modificar algo con esa fecha.";
