import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { avanzarEstadoSiCorresponde } from "@/lib/estadoAutomatico";

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

  // Si el evento es (o va a ser) interno y el pedido intenta tocar la
  // observación, solo lo permitimos si quien pide el cambio es el
  // responsable del caso. Esto evita que alguien sin acceso a ver una
  // observación interna la pise/borre editando "a ciegas".
  if ("observacion" in update) {
    const { data: existente } = await supabase
      .from("bitacora")
      .select("caso_id, es_interna")
      .eq("id", params.id)
      .maybeSingle();

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

  const { data, error } = await supabase
    .from("bitacora")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data.completado) {
    await avanzarEstadoSiCorresponde(data.caso_id, data.tipo_evento);
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { error } = await supabase.from("bitacora").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
