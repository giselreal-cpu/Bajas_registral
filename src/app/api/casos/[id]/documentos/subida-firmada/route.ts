import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearSubidaFirmada, validarMetadatosArchivo } from "@/lib/documentosStorage";

// POST /api/casos/[id]/documentos/subida-firmada -> primer paso de la carga
// de un archivo real: valida tamaño/tipo por metadatos (el archivo en sí
// todavía no viajó) y devuelve una URL de subida firmada para que el
// navegador suba directo a Supabase Storage. El segundo paso es el POST
// normal a /api/casos/[id]/documentos, con el `path` ya subido.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: caso } = await supabase.from("casos").select("id").eq("id", params.id).maybeSingle();
  if (!caso) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const { categoria, nombre, size, type } = body as {
    categoria?: string;
    nombre?: string;
    size?: number;
    type?: string;
  };

  if (!categoria || typeof size !== "number" || !nombre) {
    return NextResponse.json({ error: "Faltan datos del archivo." }, { status: 400 });
  }

  try {
    validarMetadatosArchivo({ size, type: type ?? "" });
    const subida = await crearSubidaFirmada(params.id, categoria, nombre);
    return NextResponse.json({ data: subida });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo iniciar la subida." },
      { status: 400 }
    );
  }
}
