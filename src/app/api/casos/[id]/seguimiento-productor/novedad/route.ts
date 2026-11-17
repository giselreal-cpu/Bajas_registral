import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { construirSeguimiento, EventoSeguimiento, observacionesPublicas } from "@/lib/seguimientoProductor";
import { IaNoConfigurada, redactarNovedad } from "@/lib/resumenNovedad";

// POST -> borrador de la novedad, resumido con IA a partir de las últimas
// observaciones PÚBLICAS de la bitácora. No envía nada ni guarda nada: la
// persona lo revisa y lo edita en la pantalla antes de mandar el seguimiento.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }

  const supabase = createClient();
  const { data: caso } = await supabase
    .from("casos")
    .select("id, estado, tipo_baja:tipos_baja(nombre)")
    .eq("id", params.id)
    .maybeSingle();
  if (!caso) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });

  const { data: eventos } = await supabase
    .from("bitacora")
    .select("tipo_evento, completado, fecha_inicio, fecha_fin, es_interna, observacion")
    .eq("caso_id", params.id);

  const lista = (eventos ?? []) as EventoSeguimiento[];
  const observaciones = observacionesPublicas(lista);
  if (observaciones.length === 0) {
    return NextResponse.json({ error: "El caso no tiene observaciones públicas para resumir." }, { status: 404 });
  }

  const c = caso as unknown as { estado: string; tipo_baja: { nombre: string } | null };
  const estado = construirSeguimiento({
    numero_siniestro: "",
    dominio: "",
    aseguradora: "",
    asegurado: "",
    tipo_baja: c.tipo_baja?.nombre ?? null,
    rama: null,
    estado: c.estado,
    deuda_patentes: null,
    deuda_multas: null,
    tieneGestor: false,
    responsable: null,
    eventos: lista
  }).frase;

  try {
    const borrador = await redactarNovedad(observaciones, estado);
    if (!borrador) {
      return NextResponse.json({ borrador: "", aviso: "Las observaciones no aportan nada para contarle al productor." });
    }
    return NextResponse.json({ borrador });
  } catch (e) {
    if (e instanceof IaNoConfigurada) {
      return NextResponse.json(
        { error: "La IA no está configurada: falta la variable ANTHROPIC_API_KEY en el servidor." },
        { status: 503 }
      );
    }
    if (e instanceof Anthropic.APIError) {
      console.error("seguimiento-productor/novedad", e.status, e.message);
      return NextResponse.json({ error: "No se pudo generar el borrador con la IA. Probá de nuevo." }, { status: 502 });
    }
    throw e;
  }
}
