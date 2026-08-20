import { createClient } from "@/lib/supabase/server";

// Ingresos "cobrados" (cash real, no devengado): suma de cobros + notas de
// crédito registrados contra facturas de los casos indicados. Un ingreso
// cargado como movimiento pero todavía no facturado/cobrado no cuenta acá
// — la ganancia neta tiene que reflejar plata que realmente entró, no lo
// que se facturó.
export async function ingresosCobradosPorCasos(casoIds: string[]): Promise<number> {
  if (casoIds.length === 0) return 0;
  const supabase = createClient();

  const { data: facturas } = await supabase.from("facturas").select("id").in("caso_id", casoIds);
  const facturaIds = (facturas ?? []).map((f) => f.id);
  if (facturaIds.length === 0) return 0;

  const [{ data: cobros }, { data: notas }] = await Promise.all([
    supabase.from("cobros").select("monto").in("factura_id", facturaIds),
    supabase.from("notas_credito").select("monto").in("factura_id", facturaIds)
  ]);

  return (
    (cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
    (notas ?? []).reduce((acc, n) => acc + Number(n.monto), 0)
  );
}
