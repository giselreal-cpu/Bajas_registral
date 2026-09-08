import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura } from "@/lib/facturas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// DELETE /api/facturas/[id]/notas-credito/[notaId] -> anula una nota de
// crédito cargada por error (ej. monto mal calculado). Ya ajustó el
// saldo de la factura desde que se creó, así que nunca se borra
// físicamente — se anula con motivo. Reservado a administrador.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; notaId: string } }
) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json(
      { error: "Solo un administrador puede anular una nota de crédito." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json(
      { error: "Una nota de crédito no se puede borrar — indicá el motivo de la anulación." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: nota, error: errorNota } = await supabase
    .from("notas_credito")
    .select("id, factura_id, monto, anulado, fecha")
    .eq("id", params.notaId)
    .eq("factura_id", params.id)
    .maybeSingle();

  if (errorNota || !nota) {
    return NextResponse.json({ error: errorNota?.message ?? "Nota de crédito no encontrada." }, { status: 404 });
  }
  if (nota.anulado) {
    return NextResponse.json({ error: "Esta nota de crédito ya está anulada." }, { status: 409 });
  }
  if (await periodoCerrado(supabase, nota.fecha)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const { data: factura } = await supabase
    .from("facturas")
    .select("caso_id, numero_factura")
    .eq("id", params.id)
    .maybeSingle();

  const { error: errorAnular } = await supabase
    .from("notas_credito")
    .update({
      anulado: true,
      anulado_motivo: motivo,
      anulado_at: new Date().toISOString(),
      anulado_por: usuarioActual.id
    })
    .eq("id", params.notaId);
  if (errorAnular) {
    return NextResponse.json({ error: errorAnular.message }, { status: 500 });
  }

  const nuevoEstado = await recalcularEstadoFactura(params.id);

  if (factura) {
    await registrarCambio(
      factura.caso_id,
      `Anuló nota de crédito de factura N° ${factura.numero_factura}`,
      `${motivo} — $${nota.monto}`
    );
  }

  return NextResponse.json({ ok: true, estado: nuevoEstado });
}
