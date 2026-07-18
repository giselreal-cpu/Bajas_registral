import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bitacora")
    .select("*, usuario:usuarios(*)")
    .eq("caso_id", params.id)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const {
    tipo_evento,
    observacion,
    es_interna,
    completado,
    fecha_inicio,
    fecha_fin,
    creado_por
  } = body;

  if (!tipo_evento) {
    return NextResponse.json(
      { error: "El tipo de evento es obligatorio." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("bitacora")
    .insert({
      caso_id: params.id,
      tipo_evento,
      observacion: observacion ?? null,
      es_interna: !!es_interna,
      completado: !!completado,
      fecha_inicio: fecha_inicio || new Date().toISOString().slice(0, 10),
      fecha_fin: fecha_fin ?? null,
      creado_por: creado_por ?? null
    })
    .select("*, usuario:usuarios(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
