import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarAutorizacion } from "@/lib/documentos/autorizacionRetiro";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: caso, error } = await supabase
    .from("casos")
    .select(
      `
      numero_siniestro, numero_poliza, item_poliza,
      aseguradora:aseguradoras(nombre),
      asegurado:asegurados(nombre, direccion, entre_calles, localidad, partido, provincia, telefono),
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

  const buffer = await generarAutorizacion({
    aseguradoraNombre: c.aseguradora?.nombre ?? "",
    numeroSiniestro: c.numero_siniestro,
    numeroPoliza: c.numero_poliza ?? null,
    itemPoliza: c.item_poliza ?? null,
    vehiculoMarca: c.vehiculo?.marca ?? null,
    vehiculoModelo: c.vehiculo?.modelo ?? null,
    vehiculoDominio: c.vehiculo?.dominio ?? "",
    aseguradoNombre: c.asegurado?.nombre ?? "",
    aseguradoDireccion: c.asegurado?.direccion ?? null,
    aseguradoEntreCalles: c.asegurado?.entre_calles ?? null,
    aseguradoLocalidad: c.asegurado?.localidad ?? null,
    aseguradoPartido: c.asegurado?.partido ?? null,
    aseguradoProvincia: c.asegurado?.provincia ?? null,
    aseguradoTelefono: c.asegurado?.telefono ?? null,
    destinoNombre: c.desarmadero?.nombre ?? null,
    destinoDireccion: c.desarmadero?.direccion ?? null,
    destinoProvincia: c.desarmadero?.provincia ?? null
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="autorizacion_retiro_traslado_${c.numero_siniestro}.docx"`
    }
  });
}
