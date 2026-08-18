import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

// POST /api/casos/[id]/regenerar-enlace-gestor -> invalida el enlace público
// vigente (por ejemplo, si se compartió por error) y genera uno nuevo.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("casos")
    .update({ token_gestor: randomUUID() })
    .eq("id", params.id)
    .select("token_gestor")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(params.id, "Regeneró el enlace del gestor");

  return NextResponse.json({ data });
}
