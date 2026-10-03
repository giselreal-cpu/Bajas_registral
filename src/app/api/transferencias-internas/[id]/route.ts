import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// DELETE /api/transferencias-internas/[id] -> anula una transferencia
// (con motivo; no se borra, queda visible en el historial).
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json({ error: "Indicá el motivo de la anulación." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: existente } = await supabase
    .from("transferencias_internas")
    .select("id, fecha, anulado")
    .eq("id", params.id)
    .maybeSingle();
  if (!existente || existente.anulado) {
    return NextResponse.json({ error: "Transferencia no encontrada." }, { status: 404 });
  }
  if (await periodoCerrado(supabase, existente.fecha)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const { error } = await supabase
    .from("transferencias_internas")
    .update({
      anulado: true,
      anulado_motivo: motivo,
      anulado_at: new Date().toISOString(),
      anulado_por: usuario.id
    })
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("cierres_mensuales_historial").insert({
    mes: existente.fecha.slice(0, 7),
    accion: "transferencia",
    usuario_id: usuario.id,
    motivo,
    detalle: { transferencia_id: params.id, anulada: true }
  });

  return NextResponse.json({ ok: true });
}
