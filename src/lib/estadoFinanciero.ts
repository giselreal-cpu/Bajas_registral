import { createClient } from "@/lib/supabase/server";

// Un caso está "saldado" si tiene al menos una factura generada y todas
// están cobrado_total. Cero facturas no cuenta como saldado (no hay nada
// que confirme que ya se facturó/cobró todo lo que corresponde).
export async function casoEstaSaldado(casoId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: facturas } = await supabase
    .from("facturas")
    .select("estado")
    .eq("caso_id", casoId);

  if (!facturas || facturas.length === 0) return false;

  return facturas.every((f) => f.estado === "cobrado_total");
}
