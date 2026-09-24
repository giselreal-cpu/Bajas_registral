import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { enviarEmail } from "@/lib/email/enviarEmail";
import { asuntoYCuerpo, destinatariosDisponibles, Destinatario } from "@/lib/email/notificacionesCaso";
import { resolverTramitadorId } from "@/lib/tramitadores";
import { CasoConRelaciones } from "@/types/database";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios(*),
  gestor:gestores(*)
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
    tramitador_nombre,
    tramitador_email,
    productor_nombre,
    productor_contacto,
    asegurado, // { nombre, dni, telefono, email, direccion, localidad, provincia, entre_calles, partido }
    vehiculo, // { dominio, marca, modelo, anio, chasis, motor, tipo_vehiculo }
    observaciones,
    notificar, // ("tramitador" | "productor" | "asegurado")[]
    confirmarDuplicado // true -> el usuario ya vio el aviso de dominio repetido y quiere crear igual
  } = body;

  if (!numero_siniestro || !aseguradora_id || !asegurado?.nombre || !vehiculo?.dominio) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios: número de siniestro, aseguradora, asegurado y dominio del vehículo." },
      { status: 400 }
    );
  }

  // 0. Avisar si el dominio ya tiene casos cargados, salvo que el usuario
  // ya haya confirmado que quiere crear otro igual (ej. un siniestro
  // nuevo sobre la misma unidad).
  if (!confirmarDuplicado) {
    const { data: vehiculoDominio } = await supabase
      .from("vehiculos")
      .select("id")
      .eq("dominio", vehiculo.dominio)
      .maybeSingle();

    if (vehiculoDominio) {
      const { data: casosExistentes } = await supabase
        .from("casos")
        .select("id, numero_siniestro, estado, aseguradora:aseguradoras(nombre)")
        .eq("vehiculo_id", vehiculoDominio.id);

      if (casosExistentes && casosExistentes.length > 0) {
        return NextResponse.json(
          {
            error: "dominio_duplicado",
            dominio: vehiculo.dominio,
            casos: casosExistentes
          },
          { status: 409 }
        );
      }
    }
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
        motor: vehiculo.motor ?? null,
        tipo_vehiculo: vehiculo.tipo_vehiculo ?? null
      })
      .select()
      .single();

    if (errVehiculo) {
      return NextResponse.json({ error: errVehiculo.message }, { status: 500 });
    }
    vehiculoId = nuevoVehiculo.id;
  }

  const tramitadorId = await resolverTramitadorId(supabase, tramitador_nombre, tramitador_email);

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
      observaciones: observaciones ?? null,
      tramitador_nombre: tramitador_nombre ?? null,
      tramitador_email: tramitador_email ?? null,
      tramitador_id: tramitadorId,
      productor_nombre: productor_nombre ?? null,
      productor_contacto: productor_contacto ?? null
    })
    .select(CASO_SELECT)
    .single();

  if (errCaso) {
    return NextResponse.json({ error: errCaso.message }, { status: 500 });
  }

  // 3b. Si el vehículo ya tiene tipo de vehículo (nuevo o reutilizado),
  // auto-completa el checklist del Anexo 04 desde las reglas generales
  // (mismo criterio que PUT /api/casos/[id]/anexo04/tipo-vehiculo).
  if (vehiculo.tipo_vehiculo) {
    const { data: reglas } = await supabase
      .from("reglas_piezas_rudac")
      .select("codigo, decision")
      .eq("tipo_vehiculo", vehiculo.tipo_vehiculo)
      .in("decision", ["SI", "NO"]);

    if (reglas && reglas.length > 0) {
      await supabase
        .from("caso_piezas_rudac")
        .upsert(
          reglas.map((r) => ({ caso_id: caso.id, codigo: r.codigo, decision: r.decision })),
          { onConflict: "caso_id,codigo", ignoreDuplicates: true }
        );
    }
  }

  // 4. Primer evento de bitácora automático. Si no se notificó a nadie
  // (nadie tildado en "notificar" al cargar el caso), queda pendiente en
  // vez de completado — así se puede completar después desde la bitácora,
  // que ya ofrece elegir a quién notificar al completar "Ingreso de caso"
  // (ver EVENTO_A_NOTIFICACION en BitacoraSection.tsx).
  const seNotifico = Array.isArray(notificar) && notificar.length > 0;
  await supabase.from("bitacora").insert({
    caso_id: caso.id,
    tipo_evento: "Ingreso de caso",
    observacion: "Caso creado a partir del pedido de la aseguradora.",
    completado: seNotifico,
    creado_por: responsable_id ?? null
  });

  await registrarCambio(caso.id, "Creó el caso");

  // Notificación por mail (best-effort, no bloquea la creación del caso
  // si falla). A esta altura puede haber mail de tramitador, productor
  // y/o asegurado, si se cargaron en el formulario de alta.
  if (seNotifico) {
    const casoConRelaciones = caso as unknown as CasoConRelaciones;
    const disponibles = destinatariosDisponibles(casoConRelaciones);
    const { subject, text } = asuntoYCuerpo("ingreso_caso", casoConRelaciones);
    for (const destinatario of notificar as Destinatario[]) {
      const email = disponibles[destinatario];
      if (email) {
        await enviarEmail({ to: email, subject, text });
      }
    }
  }

  return NextResponse.json({ data: caso }, { status: 201 });
}
