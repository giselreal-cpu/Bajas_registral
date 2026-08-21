import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual, getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { recalcularEstado } from "@/lib/estadoAutomatico";
import { registrarCambio } from "@/lib/historial";
import { motivoBloqueo } from "@/lib/eventosBitacora";
import { casoEstaSaldado } from "@/lib/estadoFinanciero";

const EVENTO_LIBERACION_DOCUMENTAL = "Envío de documentación Cía";

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

  const {
    tipo_evento,
    observacion,
    es_interna,
    completado,
    fecha_inicio,
    fecha_fin,
    gruero_nombre,
    gruero_contacto,
    formulario_baja_nombre,
    formulario_baja_contacto,
    excepcion_financiera,
    motivo_excepcion
  } = body;

  if (!tipo_evento) {
    return NextResponse.json(
      { error: "El tipo de evento es obligatorio." },
      { status: 400 }
    );
  }

  // Un evento no se puede volver a cargar dos veces para el mismo caso
  // (esté completado o pendiente) — salvo "Observaciones", que no tiene
  // prelación ni conexión con nada y se puede repetir libremente.
  if (tipo_evento !== "Observaciones") {
    const { data: yaExiste } = await supabase
      .from("bitacora")
      .select("id")
      .eq("caso_id", params.id)
      .eq("tipo_evento", tipo_evento)
      .limit(1)
      .maybeSingle();

    if (yaExiste) {
      return NextResponse.json(
        {
          error: `Ya existe un evento "${tipo_evento}" cargado para este caso. Editá el existente en vez de crear uno nuevo.`
        },
        { status: 409 }
      );
    }
  }

  // Si se está cargando ya como completado, no dejamos pasar si el
  // prerequisito de ese tipo de evento todavía no está cumplido. Antes
  // esto solo se validaba en el navegador; ahora también acá, para que
  // no se pueda saltear llamando a la API directo.
  if (completado) {
    const { data: eventosExistentes } = await supabase
      .from("bitacora")
      .select("id, tipo_evento, completado")
      .eq("caso_id", params.id);

    const bloqueo = motivoBloqueo(tipo_evento, eventosExistentes ?? []);
    if (bloqueo) {
      return NextResponse.json({ error: bloqueo }, { status: 409 });
    }
  }

  // Control documental atado al estado financiero: no se puede completar
  // "Envío de documentación Cía" si el caso no está saldado, salvo
  // excepción autorizada por un administrador con motivo.
  let excepcionFinancieraFinal = false;
  if (completado && tipo_evento === EVENTO_LIBERACION_DOCUMENTAL) {
    const saldado = await casoEstaSaldado(params.id);
    if (!saldado) {
      if (!excepcion_financiera) {
        return NextResponse.json(
          {
            error:
              "El caso no está saldado (todas las facturas cobradas). Se requiere autorización de un administrador para liberar documentación con excepción."
          },
          { status: 409 }
        );
      }
      const usuarioActual = await getUsuarioActual();
      if (usuarioActual?.rol !== "administrador") {
        return NextResponse.json(
          { error: "Solo un administrador puede autorizar la excepción financiera." },
          { status: 403 }
        );
      }
      if (!motivo_excepcion || !String(motivo_excepcion).trim()) {
        return NextResponse.json(
          { error: "El motivo de la excepción es obligatorio." },
          { status: 400 }
        );
      }
      excepcionFinancieraFinal = true;
    }
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
      gruero_nombre: gruero_nombre || null,
      gruero_contacto: gruero_contacto || null,
      formulario_baja_nombre: formulario_baja_nombre || null,
      formulario_baja_contacto: formulario_baja_contacto || null,
      creado_por: usuarioActualId,
      excepcion_financiera: excepcionFinancieraFinal,
      motivo_excepcion: excepcionFinancieraFinal ? motivo_excepcion : null
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const estadoDebug = await recalcularEstado(params.id);

  await registrarCambio(
    params.id,
    `Agregó evento de bitácora: ${data.tipo_evento}`,
    data.excepcion_financiera
      ? `Cargado como completado con excepción financiera: ${data.motivo_excepcion}`
      : data.completado
      ? "Cargado como completado"
      : null
  );

  return NextResponse.json({ data, estadoDebug }, { status: 201 });
}
