import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { eliminarArchivoStorage } from "@/lib/documentosStorage";

const ALLOWED_FIELDS = ["categoria", "nombre", "url"];

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
    .from("documentos")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(
    data.caso_id,
    `Editó documento: ${data.nombre}`,
    "categoria" in update ? `Nueva categoría: ${update.categoria}` : null
  );

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: existente } = await supabase
    .from("documentos")
    .select("caso_id, nombre, url")
    .eq("id", params.id)
    .maybeSingle();

  const { error } = await supabase.from("documentos").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existente) {
    await eliminarArchivoStorage(existente.url);
    await registrarCambio(existente.caso_id, `Eliminó documento: ${existente.nombre}`);
  }

  return NextResponse.json({ ok: true });
}
