import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

// DELETE /api/cierres-mensuales/[mes] -> reabre un período (AAAA-MM).
// Reservado a administrador y con motivo obligatorio: queda en el
// historial junto con el snapshot que tenía el cierre. Es la única forma
// de volver a tocar movimientos con fecha dentro de un mes ya cerrado.
export async function DELETE(request: Request, { params }: { params: { mes: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede reabrir un período." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json({ error: "Indicá el motivo de la reapertura." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: cierre } = await supabase
    .from("cierres_mensuales")
    .select("snapshot")
    .eq("mes", params.mes)
    .maybeSingle();
  if (!cierre) {
    return NextResponse.json({ error: "Ese período no está cerrado." }, { status: 404 });
  }

  const { error } = await supabase.from("cierres_mensuales").delete().eq("mes", params.mes);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("cierres_mensuales_historial").insert({
    mes: params.mes,
    accion: "reabrir",
    usuario_id: usuarioActual.id,
    motivo,
    detalle: { snapshot_anterior: cierre.snapshot }
  });

  return NextResponse.json({ ok: true });
}
