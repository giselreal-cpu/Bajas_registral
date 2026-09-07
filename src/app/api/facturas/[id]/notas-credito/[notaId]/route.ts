import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura } from "@/lib/facturas";

// DELETE /api/facturas/[id]/notas-credito/[notaId] -> revierte una nota
// de crédito cargada por error (ej. monto mal calculado), sin tocar la
// factura ni los movimientos que la originaron.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; notaId: string } }
) {
  const supabase = createClient();

  const { data: nota, error: errorNota } = await supabase
    .from("notas_credito")
    .select("id, factura_id, monto")
    .eq("id", params.notaId)
    .eq("factura_id", params.id)
    .maybeSingle();

  if (errorNota || !nota) {
    return NextResponse.json({ error: errorNota?.message ?? "Nota de crédito no encontrada." }, { status: 404 });
  }

  const { data: factura } = await supabase
    .from("facturas")
    .select("caso_id, numero_factura")
    .eq("id", params.id)
    .maybeSingle();

  const { error: errorDelete } = await supabase.from("notas_credito").delete().eq("id", params.notaId);
  if (errorDelete) {
    return NextResponse.json({ error: errorDelete.message }, { status: 500 });
  }

  const nuevoEstado = await recalcularEstadoFactura(params.id);

  if (factura) {
    await registrarCambio(
      factura.caso_id,
      `Eliminó nota de crédito de factura N° ${factura.numero_factura}`,
      `$${nota.monto}`
    );
  }

  return NextResponse.json({ ok: true, estado: nuevoEstado });
}
