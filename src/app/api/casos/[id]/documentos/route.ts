import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("caso_id", params.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/casos/[id]/documentos
// Nota: este MVP registra metadata del documento (nombre + url). La carga
// real de archivos a Supabase Storage se puede sumar después subiendo el
// archivo a un bucket y guardando acá la url pública/firmada resultante.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { categoria, nombre, url } = body;

  if (!categoria || !nombre || !url) {
    return NextResponse.json(
      { error: "categoría, nombre y url son obligatorios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({ caso_id: params.id, categoria, nombre, url })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
