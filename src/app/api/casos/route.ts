import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios(*)
`;

// GET /api/casos?estado=xxx&q=texto -> listado de casos con sus relaciones
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const q = searchParams.get("q");

  let query = supabase
    .from("casos")
    .select(CASO_SELECT)
    .order("created_at", { ascending: false });

  if (estado) {
    query = query.eq("estado", estado);
  }
  if (q) {
    query = query.ilike("numero_siniestro", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/casos -> crea aseguradora existente + asegurado y vehiculo (si vienen
// como objetos nuevos) y por último el caso.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const {
    numero_siniestro,
    numero_poliza,
    item_poliza,
    suma_asegurada,
    aseguradora_id,
    tipo_baja_id,
    responsable_id,
    asegurado, // { nombre, dni, telefono, email, direccion, localidad, provincia, entre_calles, partido }
    vehiculo, // { dominio, marca, modelo, anio, chasis, motor }
    observaciones
  } = body;

  if (!numero_siniestro || !aseguradora_id || !asegurado?.nombre || !vehiculo?.dominio) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios: número de siniestro, aseguradora, asegurado y dominio del vehículo." },
      { status: 400 }
    );
  }

  // 1. Crear asegurado
  const { data: nuevoAsegurado, error: errAsegurado } = await supabase
    .from("asegurados")
    .insert({
      nombre: asegurado.nombre,
      dni: asegurado.dni ?? null,
      telefono: asegurado.telefono ?? null,
      email: asegurado.email ?? null,
      direccion: asegurado.direccion ?? null,
      localidad: asegurado.localidad ?? null,
      provincia: asegurado.provincia ?? null,
      entre_calles: asegurado.entre_calles ?? null,
      partido: asegurado.partido ?? null
    })
    .select()
    .single();

  if (errAsegurado) {
    return NextResponse.json({ error: errAsegurado.message }, { status: 500 });
  }

  // 2. Crear (o reutilizar) vehículo por dominio
  const { data: vehiculoExistente } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("dominio", vehiculo.dominio)
    .maybeSingle();

  let vehiculoId = vehiculoExistente?.id;

  if (!vehiculoId) {
    const { data: nuevoVehiculo, error: errVehiculo } = await supabase
      .from("vehiculos")
      .insert({
        dominio: vehiculo.dominio,
        marca: vehiculo.marca ?? null,
        modelo: vehiculo.modelo ?? null,
        anio: vehiculo.anio ?? null,
        chasis: vehiculo.chasis ?? null,
        motor: vehiculo.motor ?? null
      })
      .select()
      .single();

    if (errVehiculo) {
      return NextResponse.json({ error: errVehiculo.message }, { status: 500 });
    }
    vehiculoId = nuevoVehiculo.id;
  }

  // 3. Crear el caso
  const { data: caso, error: errCaso } = await supabase
    .from("casos")
    .insert({
      numero_siniestro,
      numero_poliza: numero_poliza ?? null,
      item_poliza: item_poliza ?? null,
      suma_asegurada: suma_asegurada ?? null,
      aseguradora_id,
      asegurado_id: nuevoAsegurado.id,
      vehiculo_id: vehiculoId,
      tipo_baja_id: tipo_baja_id ?? null,
      responsable_id: responsable_id ?? null,
      observaciones: observaciones ?? null
    })
    .select(CASO_SELECT)
    .single();

  if (errCaso) {
    return NextResponse.json({ error: errCaso.message }, { status: 500 });
  }

  // 4. Primer evento de bitácora automático
  await supabase.from("bitacora").insert({
    caso_id: caso.id,
    tipo_evento: "Ingreso de caso",
    observacion: "Caso creado a partir del pedido de la aseguradora.",
    completado: true,
    creado_por: responsable_id ?? null
  });

  return NextResponse.json({ data: caso }, { status: 201 });
}
