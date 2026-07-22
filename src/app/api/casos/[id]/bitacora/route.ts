import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual, getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { avanzarEstadoSiCorresponde } from "@/lib/estadoAutomatico";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const [{ data: caso }, { data, error }, usuarioActual] = await Promise.all([
    supabase.from("casos").select("responsable_id").eq("id", params.id).maybeSingle(),
    supabase
      .from("bitacora")
      .select("*")
      .eq("caso_id", params.id)
      .order("fecha_inicio", { ascending: false })
      .order("created_at", { ascending: false }),
    getUsuarioActual()
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Las observaciones marcadas como "interna" solo se envían al cliente si
  // quien está logueado es administrador, o el responsable del caso. Esto
  // se decide acá, en el servidor, no en el navegador. (Para el rol
  // "compania" la fila entera ya viene filtrada por RLS, esto es un
  // resguardo extra para operador/administrador.)
  const puedeVerInternas =
    usuarioActual?.rol === "administrador" ||
    (!!usuarioActual && usuarioActual.id === caso?.responsable_id);

  const dataFiltrada = (data ?? []).map((ev) =>
    ev.es_interna && !puedeVerInternas ? { ...ev, observacion: null } : ev
  );

  return NextResponse.json({ data: dataFiltrada });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const usuarioActualId = await getUsuarioActualId();

  const { tipo_evento, observacion, es_interna, completado, fecha_inicio, fecha_fin } =
    body;

  if (!tipo_evento) {
    return NextResponse.json(
      { error: "El tipo de evento es obligatorio." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("bitacora")
    .insert({
      caso_id: params.id,
      tipo_evento,
      observacion: observacion ?? null,
      es_interna: !!es_interna,
      completado: !!completado,
      fecha_inicio: fecha_inicio || new Date().toISOString().slice(0, 10),
      fecha_fin: fecha_fin ?? null,
      creado_por: usuarioActualId
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data.completado) {
    await avanzarEstadoSiCorresponde(params.id, data.tipo_evento);
  }

  return NextResponse.json({ data }, { status: 201 });
}
