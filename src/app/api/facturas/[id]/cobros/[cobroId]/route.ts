import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura } from "@/lib/facturas";

// DELETE /api/facturas/[id]/cobros/[cobroId] -> revierte un cobro
// cargado por error (ej. factura generada con el receptor equivocado).
// Si el cobro venía de un anticipo aplicado, le devuelve el saldo.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; cobroId: string } }
) {
  const supabase = createClient();

  const { data: cobro, error: errorCobro } = await supabase
    .from("cobros")
    .select("id, factura_id, monto, anticipo_id")
    .eq("id", params.cobroId)
    .eq("factura_id", params.id)
    .maybeSingle();

  if (errorCobro || !cobro) {
    return NextResponse.json({ error: errorCobro?.message ?? "Cobro no encontrado." }, { status: 404 });
  }

  const { data: factura } = await supabase
    .from("facturas")
    .select("caso_id, numero_factura")
    .eq("id", params.id)
    .maybeSingle();

  const { error: errorDelete } = await supabase.from("cobros").delete().eq("id", params.cobroId);
  if (errorDelete) {
    return NextResponse.json({ error: errorDelete.message }, { status: 500 });
  }

  if (cobro.anticipo_id) {
    const { data: anticipo } = await supabase
      .from("anticipos")
      .select("saldo_disponible")
      .eq("id", cobro.anticipo_id)
      .maybeSingle();
    if (anticipo) {
      await supabase
        .from("anticipos")
        .update({ saldo_disponible: Number(anticipo.saldo_disponible) + Number(cobro.monto) })
        .eq("id", cobro.anticipo_id);
    }
  }

  const nuevoEstado = await recalcularEstadoFactura(params.id);

  if (factura) {
    await registrarCambio(
      factura.caso_id,
      `Eliminó cobro de factura N° ${factura.numero_factura}`,
      `$${cobro.monto}`
    );
  }

  return NextResponse.json({ ok: true, estado: nuevoEstado });
}
