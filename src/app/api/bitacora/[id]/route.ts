import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { avanzarEstadoSiCorresponde } from "@/lib/estadoAutomatico";
import { registrarCambio } from "@/lib/historial";

// PUT /api/bitacora/[id] -> ej. marcar como completada, editar fecha_fin, etc.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const allowedFields = [
    "tipo_evento",
    "observacion",
    "es_interna",
    "completado",
    "fecha_inicio",
    "fecha_fin"
  ];

  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field];
  }

  const { data: existente } = await supabase
    .from("bitacora")
    .select("caso_id, es_interna, tipo_evento, completado")
    .eq("id", params.id)
    .maybeSingle();

  // Si el evento es (o va a ser) interno y el pedido intenta tocar la
  // observación, solo lo permitimos si quien pide el cambio es el
  // responsable del caso. Esto evita que alguien sin acceso a ver una
  // observación interna la pise/borre editando "a ciegas".
  if ("observacion" in update) {
    const seraInterna =
      "es_interna" in update ? !!update.es_interna : !!existente?.es_interna;

    if (seraInterna && existente) {
      const [usuarioActual, { data: caso }] = await Promise.all([
        getUsuarioActual(),
        supabase.from("casos").select("responsable_id").eq("id", existente.caso_id).maybeSingle()
      ]);

      const puedeEditar =
        usuarioActual?.rol === "administrador" || usuarioActual?.id === caso?.responsable_id;

      if (!puedeEditar) {
        delete update.observacion;
      }
    }
  }

  // Un evento no puede repetirse dos veces para el mismo caso (salvo
  // "Observaciones"). Esto cubre el caso de editar un evento pendiente y
  // cambiarle el tipo hacia uno que ya existe (completado o no) en otra
  // fila de este mismo caso.
  if (existente) {
    const tipoFinal = ("tipo_evento" in update ? update.tipo_evento : existente.tipo_evento) as string;

    if (tipoFinal !== "Observaciones") {
      const { data: otroExistente } = await supabase
        .from("bitacora")
        .select("id")
        .eq("caso_id", existente.caso_id)
        .eq("tipo_evento", tipoFinal)
        .neq("id", params.id)
        .limit(1)
        .maybeSingle();

      if (otroExistente) {
        return NextResponse.json(
          {
            error: `Ya existe un evento "${tipoFinal}" cargado para este caso. Editá el existente en vez de crear uno nuevo.`
          },
          { status: 409 }
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("bitacora")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let estadoDebug = null;
  if (data.completado) {
    estadoDebug = await avanzarEstadoSiCorresponde(data.caso_id, data.tipo_evento);
  }

  const marcoCompletado = "completado" in update && update.completado && !existente?.completado;
  await registrarCambio(
    data.caso_id,
    marcoCompletado
      ? `Completó evento de bitácora: ${data.tipo_evento}`
      : `Editó evento de bitácora: ${data.tipo_evento}`
  );

  return NextResponse.json({ data, estadoDebug });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: existente } = await supabase
    .from("bitacora")
    .select("caso_id, tipo_evento")
    .eq("id", params.id)
    .maybeSingle();

  const { error } = await supabase.from("bitacora").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existente) {
    await registrarCambio(existente.caso_id, `Eliminó evento de bitácora: ${existente.tipo_evento}`);
  }

  return NextResponse.json({ ok: true });
}
