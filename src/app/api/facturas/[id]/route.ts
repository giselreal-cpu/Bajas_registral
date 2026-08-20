import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

// DELETE /api/facturas/[id] -> elimina una factura que todavía no tuvo
// ningún cobro ni nota de crédito, y devuelve sus movimientos al pool de
// "sin facturar" del caso para que se puedan volver a agrupar.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: factura, error: errorFactura } = await supabase
    .from("facturas")
    .select("id, caso_id, numero_factura")
    .eq("id", params.id)
    .maybeSingle();

  if (errorFactura || !factura) {
    return NextResponse.json({ error: errorFactura?.message ?? "Factura no encontrada." }, { status: 404 });
  }

  const [{ count: cobros }, { count: notas }] = await Promise.all([
    supabase.from("cobros").select("id", { count: "exact", head: true }).eq("factura_id", params.id),
    supabase.from("notas_credito").select("id", { count: "exact", head: true }).eq("factura_id", params.id)
  ]);

  if ((cobros ?? 0) > 0 || (notas ?? 0) > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar una factura que ya tiene cobros o notas de crédito registrados." },
      { status: 409 }
    );
  }

  await supabase.from("movimientos_caso").update({ factura_id: null }).eq("factura_id", params.id);

  const { error: errorDelete } = await supabase.from("facturas").delete().eq("id", params.id);
  if (errorDelete) {
    return NextResponse.json({ error: errorDelete.message }, { status: 500 });
  }

  await registrarCambio(factura.caso_id, `Eliminó factura N° ${factura.numero_factura}`);

  return NextResponse.json({ ok: true });
}
