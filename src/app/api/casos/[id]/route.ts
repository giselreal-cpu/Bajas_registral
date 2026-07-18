import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios(*)
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("casos")
    .select(CASO_SELECT)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PUT /api/casos/[id] -> actualiza campos de la cabecera del caso
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const allowedFields = [
    "numero_siniestro",
    "estado",
    "rama",
    "tipo_tramite",
    "desarmadero_id",
    "registro_id",
    "tipo_baja_id",
    "responsable_id",
    "fecha_cierre",
    "deuda_patentes",
    "deuda_multas",
    "observaciones"
  ];

  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field];
  }

  const { data, error } = await supabase
    .from("casos")
    .update(update)
    .eq("id", params.id)
    .select(CASO_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { error } = await supabase.from("casos").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
