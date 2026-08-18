import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { eliminarArchivoStorage, obtenerUrlFirmada, subirArchivoDocumento } from "@/lib/documentosStorage";

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

  const documentos = await Promise.all(
    (data ?? []).map(async (doc) => ({ ...doc, url_firmada: await obtenerUrlFirmada(doc.url) }))
  );

  return NextResponse.json({ data: documentos });
}

// POST /api/casos/[id]/documentos -> recibe multipart/form-data (archivo +
// categoria + nombre opcional), lo sube al bucket privado y guarda la
// metadata + la ruta interna del archivo.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const formData = await request.formData();
  const file = formData.get("file");
  const categoria = formData.get("categoria");
  const nombre = formData.get("nombre");

  if (!(file instanceof File) || file.size === 0 || !categoria) {
    return NextResponse.json(
      { error: "El archivo y la categoría son obligatorios." },
      { status: 400 }
    );
  }

  let path: string;
  try {
    path = await subirArchivoDocumento(params.id, categoria as string, file);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo subir el archivo." },
      { status: 400 }
    );
  }

  const nombreFinal = (nombre as string) || file.name;

  const { data, error } = await supabase
    .from("documentos")
    .insert({ caso_id: params.id, categoria: categoria as string, nombre: nombreFinal, url: path })
    .select()
    .single();

  if (error) {
    await eliminarArchivoStorage(path);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(params.id, `Agregó documento: ${nombreFinal}`, categoria as string);

  const url_firmada = await obtenerUrlFirmada(path);
  return NextResponse.json({ data: { ...data, url_firmada } }, { status: 201 });
}
