import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarAutorizacion } from "@/lib/documentos/autorizacionRetiro";
import { generarAutorizacionPdf } from "@/lib/documentos/autorizacionRetiroPdf";
import { descargarLogoBytes } from "@/lib/logoAseguradora";

const LOGO_OLTRA_PATH = path.join(process.cwd(), "public", "logo-oltra.jpg");

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: caso, error } = await supabase
    .from("casos")
    .select(
      `
      numero_siniestro, numero_poliza,
      aseguradora:aseguradoras(nombre, logo_path),
      asegurado:asegurados(nombre, dni, direccion, entre_calles, localidad, partido, provincia, telefono),
      vehiculo:vehiculos(marca, modelo, dominio),
      desarmadero:desarmaderos(nombre, direccion, provincia)
    `
    )
    .eq("id", params.id)
    .single();

  if (error || !caso) {
    return NextResponse.json({ error: error?.message ?? "Caso no encontrado." }, { status: 404 });
  }

  // TypeScript infiere las relaciones anidadas del select como arrays
  // aunque en la base sean de a uno; casteamos acá (mismo patrón que en
  // /api/export y /api/agenda) para poder acceder a los campos.
  const c = caso as any;

  const [logoAseguradoraBuffer, logoOltraBuffer] = await Promise.all([
    descargarLogoBytes(c.aseguradora?.logo_path ?? null),
    fs.promises.readFile(LOGO_OLTRA_PATH).catch(() => null)
  ]);

  const datos = {
    aseguradoraNombre: c.aseguradora?.nombre ?? "",
    numeroSiniestro: c.numero_siniestro,
    numeroPoliza: c.numero_poliza ?? null,
    vehiculoMarca: c.vehiculo?.marca ?? null,
    vehiculoModelo: c.vehiculo?.modelo ?? null,
    vehiculoDominio: c.vehiculo?.dominio ?? "",
    aseguradoNombre: c.asegurado?.nombre ?? "",
    aseguradoDni: c.asegurado?.dni ?? null,
    aseguradoDireccion: c.asegurado?.direccion ?? null,
    aseguradoEntreCalles: c.asegurado?.entre_calles ?? null,
    aseguradoLocalidad: c.asegurado?.localidad ?? null,
    aseguradoPartido: c.asegurado?.partido ?? null,
    aseguradoProvincia: c.asegurado?.provincia ?? null,
    aseguradoTelefono: c.asegurado?.telefono ?? null,
    logoAseguradoraBuffer,
    logoOltraBuffer
  };

  const formato = request.nextUrl.searchParams.get("formato") === "pdf" ? "pdf" : "docx";

  if (formato === "pdf") {
    const buffer = await generarAutorizacionPdf(datos);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="autorizacion_retiro_traslado_${c.numero_siniestro}.pdf"`
      }
    });
  }

  const buffer = await generarAutorizacion(datos);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="autorizacion_retiro_traslado_${c.numero_siniestro}.docx"`
    }
  });
}
