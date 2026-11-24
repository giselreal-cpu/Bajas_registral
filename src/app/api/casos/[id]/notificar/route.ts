import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/email/enviarEmail";
import {
  asuntoYCuerpo,
  destinatariosDisponibles,
  Destinatario,
  DESTINATARIOS,
  llevaInformeDominio,
  TipoNotificacion
} from "@/lib/email/notificacionesCaso";
import { obtenerAdjuntosInformeDominio, type ResultadoAdjuntos } from "@/lib/email/adjuntosInformeDominio";
import { CasoConRelaciones } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerProveedorReposicion } from "@/lib/proveedoresReposicion";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios!responsable_id(*),
  gestor:gestores(*)
`;

// POST /api/casos/[id]/notificar -> envía por mail el aviso del evento
// indicado a los destinatarios elegidos (solo a los que tengan mail
// cargado). Best-effort: nunca bloquea ni revierte la acción que ya se
// guardó (completar un evento, asignar un gestor, etc.), solo informa
// qué se pudo enviar y qué no.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = await request.json();

  const tipo = body.tipo as TipoNotificacion;
  const destinatariosPedidos = (body.destinatarios ?? []) as Destinatario[];

  const tiposValidos: TipoNotificacion[] = [
    "ingreso_caso",
    "peticion_informes",
    "contacto_asegurado",
    "gestor_asignado",
    "traslado",
    "presentacion_baja",
    "cierre_caso"
  ];
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de notificación inválido." }, { status: 400 });
  }

  const destinatariosValidos = DESTINATARIOS.map((d) => d.value);
  const pedidosValidos = destinatariosPedidos.filter((d) => destinatariosValidos.includes(d));

  if (pedidosValidos.length === 0) {
    return NextResponse.json({ enviados: [], fallidos: [] });
  }

  const { data, error } = await supabase
    .from("casos")
    .select(CASO_SELECT)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const caso = data as unknown as CasoConRelaciones;
  caso.proveedor_reposicion = await obtenerProveedorReposicion(
    supabase as unknown as SupabaseClient,
    caso.proveedor_reposicion_id
  );
  const disponibles = destinatariosDisponibles(caso);

  const enviados: string[] = [];
  const fallidos: { destinatario: string; error: string }[] = [];
  // Destinatarios a los que se les mandó el informe de dominio adjunto.
  const conInforme: string[] = [];
  // Destinatarios a los que el informe fue como enlace (no se pudo adjuntar).
  const conEnlace: string[] = [];

  // La compañía (tramitador / productor) recibe el informe de dominio como
  // comprobante del estado de la unidad. Se descarga una sola vez, y solo si
  // alguno de los destinatarios pedidos lo lleva.
  const pedidosConInforme = pedidosValidos.filter((d) => disponibles[d] && llevaInformeDominio(tipo, d));
  const informe: ResultadoAdjuntos | null =
    pedidosConInforme.length > 0
      ? await obtenerAdjuntosInformeDominio(supabase as unknown as SupabaseClient, params.id)
      : null;

  for (const destinatario of pedidosValidos) {
    const email = disponibles[destinatario];
    if (!email) {
      fallidos.push({ destinatario, error: "No tiene mail cargado." });
      continue;
    }
    const lleva = llevaInformeDominio(tipo, destinatario);
    // Sin informe no se manda el aviso a la compañía: lo necesita como comprobante.
    const adjuntos = lleva ? informe?.adjuntos ?? [] : [];
    const enlaces = lleva ? informe?.enlaces ?? [] : [];
    if (lleva && adjuntos.length === 0 && enlaces.length === 0) {
      fallidos.push({ destinatario, error: informe?.error ?? "No se pudo adjuntar el informe de dominio." });
      continue;
    }
    const { subject, text } = asuntoYCuerpo(tipo, caso, destinatario, {
      conInformeAdjunto: adjuntos.length > 0,
      enlacesInforme: enlaces
    });
    const resultado = await enviarEmail({
      to: email,
      subject,
      text,
      attachments: adjuntos.length > 0 ? adjuntos : undefined
    });
    if (resultado.ok) {
      enviados.push(destinatario);
      if (adjuntos.length > 0) conInforme.push(destinatario);
      if (enlaces.length > 0) conEnlace.push(destinatario);
    } else {
      fallidos.push({ destinatario, error: resultado.error ?? "No se pudo enviar." });
    }
  }

  return NextResponse.json({ enviados, fallidos, conInforme, conEnlace });
}
