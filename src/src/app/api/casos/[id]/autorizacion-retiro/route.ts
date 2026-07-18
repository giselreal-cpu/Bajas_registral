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

  const buffer = await generarAutorizacion({
    aseguradoraNombre: caso.aseguradora?.nombre ?? "",
    numeroSiniestro: caso.numero_siniestro,
    numeroPoliza: caso.numero_poliza ?? null,
    itemPoliza: caso.item_poliza ?? null,
    vehiculoMarca: caso.vehiculo?.marca ?? null,
    vehiculoModelo: caso.vehiculo?.modelo ?? null,
    vehiculoDominio: caso.vehiculo?.dominio ?? "",
    aseguradoNombre: caso.asegurado?.nombre ?? "",
    aseguradoDireccion: caso.asegurado?.direccion ?? null,
    aseguradoEntreCalles: caso.asegurado?.entre_calles ?? null,
    aseguradoLocalidad: caso.asegurado?.localidad ?? null,
    aseguradoPartido: caso.asegurado?.partido ?? null,
    aseguradoProvincia: caso.asegurado?.provincia ?? null,
    aseguradoTelefono: caso.asegurado?.telefono ?? null,
    destinoNombre: caso.desarmadero?.nombre ?? null,
    destinoDireccion: caso.desarmadero?.direccion ?? null,
    destinoProvincia: caso.desarmadero?.provincia ?? null
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="autorizacion_retiro_traslado_${caso.numero_siniestro}.docx"`
    }
  });
}
