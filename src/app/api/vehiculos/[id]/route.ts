import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

const ALLOWED_FIELDS = ["dominio", "marca", "modelo", "anio", "chasis", "motor"];

// No exponemos DELETE acá (un vehículo con un caso asociado no debería
// poder borrarse desde esta pantalla).
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
    .from("vehiculos")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // El caller (CasoCabecera) manda el id del caso desde el que se está
  // editando, para poder registrar el cambio en el historial de ese caso
  // puntual (un mismo vehículo, en teoría, podría estar en más de uno).
  if (typeof body.casoId === "string") {
    await registrarCambio(
      body.casoId,
      "Editó datos del vehículo",
      Object.keys(update).join(", ") || null
    );
  }

  return NextResponse.json({ data });
}
