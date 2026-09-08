import { createClient } from "@/lib/supabase/server";
import { getUsuarioActualId } from "@/lib/auth/usuarioActual";

// Registra una entrada en el historial de auditoría de un caso. Si por
// algún motivo falla (por ejemplo, RLS o un problema de red puntual), no
// hacemos fallar la acción principal por esto — el historial es un
// registro adicional, no algo que deba bloquear el guardado real.
export async function registrarCambio(
  casoId: string,
  tipoCambio: string,
  detalle?: string | null
) {
  try {
    const supabase = createClient();
    const usuarioId = await getUsuarioActualId();
    await supabase.from("historial_cambios").insert({
      caso_id: casoId,
      usuario_id: usuarioId,
      tipo_cambio: tipoCambio,
      detalle: detalle ?? null
    });
  } catch {
    // Silencioso a propósito, ver comentario arriba.
  }
}

// Mismo criterio que registrarCambio, para movimientos_generales
// (sueldos, alquiler, hosting, etc.) — no están atados a un caso, así
// que no pueden usar historial_cambios y tienen su propia tabla.
export async function registrarCambioGeneral(
  movimientoGeneralId: string,
  tipoCambio: string,
  detalle?: string | null
) {
  try {
    const supabase = createClient();
    const usuarioId = await getUsuarioActualId();
    await supabase.from("historial_movimientos_generales").insert({
      movimiento_general_id: movimientoGeneralId,
      usuario_id: usuarioId,
      tipo_cambio: tipoCambio,
      detalle: detalle ?? null
    });
  } catch {
    // Silencioso a propósito, ver comentario arriba.
  }
}
