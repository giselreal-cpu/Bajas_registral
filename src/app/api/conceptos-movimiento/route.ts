import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reemplaza el factory genérico de catalogHandlers acá porque necesitamos
// traer la cuenta contable sugerida (mapeo por defecto) junto con cada
// concepto — ver 0041_cajas_cuentas_contables.sql.
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conceptos_movimiento")
    .select("*, cuenta_contable:cuentas_contables(*)")
    .order("nombre");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const insert: Record<string, unknown> = {};
  for (const field of ["nombre", "tipo", "cuenta_contable_id"]) {
    if (field in body) insert[field] = body[field] === "" ? null : body[field];
  }

  const { data, error } = await supabase
    .from("conceptos_movimiento")
    .insert(insert)
    .select("*, cuenta_contable:cuentas_contables(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
