import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { eliminarArchivoStorage, esArchivo, obtenerUrlFirmada, subirArchivoDocumento } from "@/lib/documentosStorage";

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

// POST /api/casos/[id]/documentos -> recibe multipart/form-data (categoria +
// nombre opcional, y O BIEN un archivo real O BIEN un link ya alojado en
// otro lado, por ejemplo una carpeta de Drive). El equipo interno suele
// seguir usando el link (así es como se organiza hoy); el archivo real es
// para quien prefiera subirlo directo. El enlace del gestor, en cambio,
// siempre sube archivo real (ver src/app/g/[token]/actions.ts).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const formData = await request.formData();
  const file = formData.get("file");
  const url = formData.get("url");
  const categoria = formData.get("categoria");
  const nombre = formData.get("nombre");

  if (!categoria) {
    return NextResponse.json({ error: "La categoría es obligatoria." }, { status: 400 });
  }

  let path: string;
  let nombreFinal: string;

  if (esArchivo(file) && file.size > 0) {
    try {
      path = await subirArchivoDocumento(params.id, categoria as string, file);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "No se pudo subir el archivo." },
        { status: 400 }
      );
    }
    nombreFinal = (nombre as string) || file.name;
  } else if (typeof url === "string" && url.trim()) {
    path = url.trim();
    nombreFinal = (nombre as string) || path;
  } else {
    return NextResponse.json(
      { error: "Adjuntá un archivo o pegá un link." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({ caso_id: params.id, categoria: categoria as string, nombre: nombreFinal, url: path })
    .select()
    .single();

  if (error) {
    if (esArchivo(file)) await eliminarArchivoStorage(path);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(params.id, `Agregó documento: ${nombreFinal}`, categoria as string);

  const url_firmada = await obtenerUrlFirmada(path);
  return NextResponse.json({ data: { ...data, url_firmada } }, { status: 201 });
}
