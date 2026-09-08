import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambioGeneral } from "@/lib/historial";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";
import { obtenerMonedaCaja } from "@/lib/cajaPesos";

const ALLOWED_FIELDS = ["fecha", "descripcion", "tipo", "monto", "caja_id", "cuenta_contable_id"];

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = await request.json();

  const { data: existente } = await supabase
    .from("movimientos_generales")
    .select("fecha")
    .eq("id", params.id)
    .maybeSingle();
  if (existente && (await periodoCerrado(supabase, existente.fecha))) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }
  if (typeof body.fecha === "string" && body.fecha && (await periodoCerrado(supabase, body.fecha))) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field] === "" ? null : body[field];
  }
  if ("caja_id" in update) {
    update.moneda = await obtenerMonedaCaja(supabase, update.caja_id as string | null);
  }

  const { data, error } = await supabase
    .from("movimientos_generales")
    .update(update)
    .eq("id", params.id)
    .select("*, caja:cajas(*), cuenta_contable:cuentas_contables(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambioGeneral(params.id, `Editó movimiento general: ${data.descripcion}`, `$${data.monto}`);

  return NextResponse.json({ data });
}

// Un movimiento general (sueldo, alquiler, hosting, etc.) no tiene
// estado "pendiente" — representa plata ya real desde que se carga, así
// que nunca se borra físicamente: se anula con motivo. Reservado a
// administrador, mismo criterio que el resto de las anulaciones.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json(
      { error: "Solo un administrador puede anular un movimiento general." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json(
      { error: "Un movimiento general no se puede borrar — indicá el motivo de la anulación." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: existente } = await supabase
    .from("movimientos_generales")
    .select("descripcion, monto, anulado, fecha")
    .eq("id", params.id)
    .maybeSingle();

  if (!existente) {
    return NextResponse.json({ error: "Movimiento no encontrado." }, { status: 404 });
  }
  if (existente.anulado) {
    return NextResponse.json({ error: "Este movimiento ya está anulado." }, { status: 409 });
  }
  if (await periodoCerrado(supabase, existente.fecha)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const { error } = await supabase
    .from("movimientos_generales")
    .update({
      anulado: true,
      anulado_motivo: motivo,
      anulado_at: new Date().toISOString(),
      anulado_por: usuarioActual.id
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambioGeneral(
    params.id,
    `Anuló movimiento general: ${existente.descripcion}`,
    `${motivo} — $${existente.monto}`
  );

  return NextResponse.json({ ok: true });
}
