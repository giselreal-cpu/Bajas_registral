import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambioGeneral } from "@/lib/historial";

const ALLOWED_FIELDS = ["fecha", "descripcion", "tipo", "monto", "caja_id", "cuenta_contable_id"];

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = await request.json();

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field] === "" ? null : body[field];
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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: existente } = await supabase
    .from("movimientos_generales")
    .select("descripcion, monto")
    .eq("id", params.id)
    .maybeSingle();

  // El registro de auditoría se hace ANTES de borrar: la fila de
  // historial referencia movimiento_general_id con FK — si se borrara
  // primero, ya no habría a qué apuntar.
  if (existente) {
    await registrarCambioGeneral(
      params.id,
      `Eliminó movimiento general: ${existente.descripcion}`,
      `$${existente.monto}`
    );
  }

  const { error } = await supabase.from("movimientos_generales").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
