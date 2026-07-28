import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

const ALLOWED_FIELDS = [
  "nombre",
  "dni",
  "telefono",
  "email",
  "direccion",
  "localidad",
  "provincia",
  "entre_calles",
  "partido"
];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field] === "" ? null : body[field];
  }

  const { data, error } = await supabase
    .from("asegurados")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.casoId === "string") {
    await registrarCambio(
      body.casoId,
      "Editó datos del asegurado",
      Object.keys(update).join(", ") || null
    );
  }

  return NextResponse.json({ data });
}
