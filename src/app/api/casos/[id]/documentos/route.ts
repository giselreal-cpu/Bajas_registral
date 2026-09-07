import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { eliminarArchivoStorage, obtenerUrlFirmada } from "@/lib/documentosStorage";

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

// POST /api/casos/[id]/documentos -> recibe JSON (categoria + nombre
// opcional, y O BIEN `path` de un archivo ya subido directo a Storage con
// una URL firmada de /subida-firmada, O BIEN `url` de un link ya alojado
// en otro lado, por ejemplo una carpeta de Drive). El archivo en sí nunca
// pasa por acá — por eso el archivo real sube en dos pasos, no uno solo:
// Vercel limita a 4.5MB el body de cualquier función serverless.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { categoria, nombre, path: pathSubido, url } = body as {
    categoria?: string;
    nombre?: string;
    path?: string;
    url?: string;
  };

  if (!categoria) {
    return NextResponse.json({ error: "La categoría es obligatoria." }, { status: 400 });
  }

  let path: string;
  let nombreFinal: string;
  let esArchivoReal: boolean;

  if (pathSubido) {
    path = pathSubido;
    nombreFinal = nombre || pathSubido;
    esArchivoReal = true;
  } else if (typeof url === "string" && url.trim()) {
    path = url.trim();
    nombreFinal = nombre || path;
    esArchivoReal = false;
  } else {
    return NextResponse.json(
      { error: "Adjuntá un archivo o pegá un link." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("documentos")
    .insert({ caso_id: params.id, categoria, nombre: nombreFinal, url: path })
    .select()
    .single();

  if (error) {
    if (esArchivoReal) await eliminarArchivoStorage(path);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(params.id, `Agregó documento: ${nombreFinal}`, categoria);

  const url_firmada = await obtenerUrlFirmada(path);
  return NextResponse.json({ data: { ...data, url_firmada } }, { status: 201 });
}
