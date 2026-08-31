import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subirLogoAseguradora, eliminarLogoAseguradora, descargarLogoBytes } from "@/lib/logoAseguradora";

const CONTENT_TYPE_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

// GET /api/aseguradoras/[id]/logo -> sirve los bytes del logo (para
// mostrar una previsualización en el catálogo; el bucket es privado).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: aseguradora } = await supabase
    .from("aseguradoras")
    .select("logo_path")
    .eq("id", params.id)
    .maybeSingle();

  if (!aseguradora?.logo_path) {
    return NextResponse.json({ error: "Sin logo cargado." }, { status: 404 });
  }

  const bytes = await descargarLogoBytes(aseguradora.logo_path);
  if (!bytes) {
    return NextResponse.json({ error: "No se pudo leer el logo." }, { status: 404 });
  }

  const extension = aseguradora.logo_path.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE_POR_EXTENSION[extension] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    }
  });
}

// POST /api/aseguradoras/[id]/logo -> sube (o reemplaza) el logo de la
// aseguradora, usado en el encabezado de la Autorización de retiro.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "Elegí una imagen." }, { status: 400 });
  }

  try {
    const path = await subirLogoAseguradora(params.id, file);
    return NextResponse.json({ data: { logo_path: path } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo subir el logo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: aseguradora } = await supabase
    .from("aseguradoras")
    .select("logo_path")
    .eq("id", params.id)
    .maybeSingle();

  if (aseguradora?.logo_path) {
    await eliminarLogoAseguradora(params.id, aseguradora.logo_path);
  }

  return NextResponse.json({ ok: true });
}
