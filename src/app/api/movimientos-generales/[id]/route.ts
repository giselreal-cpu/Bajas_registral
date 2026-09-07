import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { error } = await supabase.from("movimientos_generales").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
