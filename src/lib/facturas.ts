import { createClient } from "@/lib/supabase/server";
import type { EstadoFactura } from "@/types/database";

// Recalcula el estado de una factura sumando cobros + notas de crédito
// contra su monto_total (mismo criterio para ambos: una nota de crédito
// netea el saldo pendiente igual que un cobro, aunque no haya entrado
// plata real). Se llama después de cualquier alta de cobro, aplicación
// de anticipo, o nota de crédito.
export async function recalcularEstadoFactura(facturaId: string): Promise<EstadoFactura> {
  const supabase = createClient();

  const [{ data: factura }, { data: cobros }, { data: notas }] = await Promise.all([
    supabase.from("facturas").select("monto_total").eq("id", facturaId).maybeSingle(),
    supabase.from("cobros").select("monto").eq("factura_id", facturaId),
    supabase.from("notas_credito").select("monto").eq("factura_id", facturaId)
  ]);

  const totalCobrado =
    (cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
    (notas ?? []).reduce((acc, n) => acc + Number(n.monto), 0);

  const nuevoEstado: EstadoFactura =
    totalCobrado >= Number(factura?.monto_total ?? 0)
      ? "cobrado_total"
      : totalCobrado > 0
      ? "cobrado_parcial"
      : "pendiente";

  await supabase.from("facturas").update({ estado: nuevoEstado }).eq("id", facturaId);

  return nuevoEstado;
}

// Saldo pendiente actual de una factura (monto_total - cobros - notas de
// crédito ya emitidas). Se usa para validar que un nuevo cobro/nota de
// crédito/aplicación de anticipo no exceda lo que realmente falta cubrir.
export async function saldoPendienteFactura(facturaId: string): Promise<number> {
  const supabase = createClient();

  const [{ data: factura }, { data: cobros }, { data: notas }] = await Promise.all([
    supabase.from("facturas").select("monto_total").eq("id", facturaId).maybeSingle(),
    supabase.from("cobros").select("monto").eq("factura_id", facturaId),
    supabase.from("notas_credito").select("monto").eq("factura_id", facturaId)
  ]);

  const cubierto =
    (cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
    (notas ?? []).reduce((acc, n) => acc + Number(n.monto), 0);

  return Math.max(0, Number(factura?.monto_total ?? 0) - cubierto);
}
