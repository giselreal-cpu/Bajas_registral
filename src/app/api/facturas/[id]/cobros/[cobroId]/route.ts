import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura } from "@/lib/facturas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// DELETE /api/facturas/[id]/cobros/[cobroId] -> anula un cobro cargado
// por error (ej. factura generada con el receptor equivocado). Un
// cobro es siempre plata real ya recibida, así que nunca se borra
// físicamente — se anula con motivo (recalcula el estado de la
// factura y, si venía de un anticipo aplicado, le devuelve el saldo).
// Reservado a administrador, mismo criterio que anular un egreso pagado.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; cobroId: string } }
) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede anular un cobro." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json(
      { error: "Un cobro no se puede borrar — indicá el motivo de la anulación." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: cobro, error: errorCobro } = await supabase
    .from("cobros")
    .select("id, factura_id, monto, anticipo_id, anulado, fecha")
    .eq("id", params.cobroId)
    .eq("factura_id", params.id)
    .maybeSingle();

  if (errorCobro || !cobro) {
    return NextResponse.json({ error: errorCobro?.message ?? "Cobro no encontrado." }, { status: 404 });
  }
  if (cobro.anulado) {
    return NextResponse.json({ error: "Este cobro ya está anulado." }, { status: 409 });
  }
  if (await periodoCerrado(supabase, cobro.fecha)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const { data: factura } = await supabase
    .from("facturas")
    .select("caso_id, numero_factura")
    .eq("id", params.id)
    .maybeSingle();

  const { error: errorAnular } = await supabase
    .from("cobros")
    .update({
      anulado: true,
      anulado_motivo: motivo,
      anulado_at: new Date().toISOString(),
      anulado_por: usuarioActual.id
    })
    .eq("id", params.cobroId);
  if (errorAnular) {
    return NextResponse.json({ error: errorAnular.message }, { status: 500 });
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
      `Anuló cobro de factura N° ${factura.numero_factura}`,
      `${motivo} — $${cobro.monto}`
    );
  }

  return NextResponse.json({ ok: true, estado: nuevoEstado });
}
