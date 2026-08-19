import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { generarAutorizacion } from "@/lib/documentos/autorizacionRetiro";

// GET /gr/[token]/autorizacion-retiro -> descarga pública (sin sesión) de
// la Autorización de Retiro y Traslado para el gruero asignado en el
// evento de bitácora "Traslado" dueño de ese token.
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient();

  const { data: evento } = await supabase
    .from("bitacora")
    .select("gruero_nombre, caso_id")
    .eq("token_gruero", params.token)
    .eq("tipo_evento", "Traslado")
    .maybeSingle();

  if (!evento || !evento.gruero_nombre) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 404 });
  }

  const { data: caso, error } = await supabase
    .from("casos")
    .select(
      `
      numero_siniestro, numero_poliza, item_poliza,
      tercero_nombre, tercero_dni, tercero_contacto,
      aseguradora:aseguradoras(nombre),
      asegurado:asegurados(nombre, dni, direccion, entre_calles, localidad, partido, provincia, telefono),
      vehiculo:vehiculos(marca, modelo, dominio),
      desarmadero:desarmaderos(nombre, direccion, provincia)
    `
    )
    .eq("id", evento.caso_id)
    .single();

  if (error || !caso) {
    return NextResponse.json({ error: error?.message ?? "Caso no encontrado." }, { status: 404 });
  }

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
    aseguradoDni: c.asegurado?.dni ?? null,
    aseguradoDireccion: c.asegurado?.direccion ?? null,
    aseguradoEntreCalles: c.asegurado?.entre_calles ?? null,
    aseguradoLocalidad: c.asegurado?.localidad ?? null,
    aseguradoPartido: c.asegurado?.partido ?? null,
    aseguradoProvincia: c.asegurado?.provincia ?? null,
    aseguradoTelefono: c.asegurado?.telefono ?? null,
    destinoNombre: c.desarmadero?.nombre ?? null,
    destinoDireccion: c.desarmadero?.direccion ?? null,
    destinoProvincia: c.desarmadero?.provincia ?? null,
    terceroNombre: c.tercero_nombre ?? null,
    terceroDni: c.tercero_dni ?? null,
    terceroContacto: c.tercero_contacto ?? null
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="autorizacion_retiro_traslado_${c.numero_siniestro}.docx"`
    }
  });
}
