import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

const ALLOWED_FIELDS = ["concepto_id", "monto", "fecha", "observacion"];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const { data: existente } = await supabase
    .from("movimientos_caso")
    .select("caso_id, factura_id")
    .eq("id", params.id)
    .maybeSingle();

  if (existente?.factura_id) {
    return NextResponse.json(
      { error: "No se puede editar un movimiento que ya está en una factura." },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field] === "" ? null : body[field];
  }

  const { data, error } = await supabase
    .from("movimientos_caso")
    .update(update)
    .eq("id", params.id)
    .select("*, concepto:conceptos_movimiento(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(data.caso_id, `Editó movimiento: ${data.concepto?.nombre ?? "—"}`);

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: existente } = await supabase
    .from("movimientos_caso")
    .select("caso_id, factura_id, monto, concepto:conceptos_movimiento(nombre)")
    .eq("id", params.id)
    .maybeSingle();

  if (existente?.factura_id) {
    return NextResponse.json(
      { error: "No se puede eliminar un movimiento que ya está en una factura." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("movimientos_caso").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existente) {
    const nombreConcepto = (existente.concepto as unknown as { nombre: string } | null)?.nombre ?? "—";
    await registrarCambio(existente.caso_id, `Eliminó movimiento: ${nombreConcepto}`);
  }

  return NextResponse.json({ ok: true });
}
