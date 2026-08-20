import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/aseguradoras/[id]/comercial -> configuración comercial de esa
// aseguradora (% al desarmadero, % a la compañía, base de cálculo).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comercial_aseguradora")
    .select("*")
    .eq("aseguradora_id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// PUT /api/aseguradoras/[id]/comercial -> crea o actualiza (upsert por
// aseguradora_id, que es unique).
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { porcentaje_desarmadero, porcentaje_compania, base_calculo_compania } = body;

  const { data, error } = await supabase
    .from("comercial_aseguradora")
    .upsert(
      {
        aseguradora_id: params.id,
        porcentaje_desarmadero: porcentaje_desarmadero === "" ? null : porcentaje_desarmadero,
        porcentaje_compania: porcentaje_compania === "" ? null : porcentaje_compania,
        base_calculo_compania: base_calculo_compania || null
      },
      { onConflict: "aseguradora_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
