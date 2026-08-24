import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/email/enviarEmail";
import {
  asuntoYCuerpo,
  destinatariosDisponibles,
  Destinatario,
  DESTINATARIOS,
  TipoNotificacion
} from "@/lib/email/notificacionesCaso";
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
    "contacto_asegurado",
    "gestor_asignado",
    "traslado",
    "presentacion_baja"
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
  const disponibles = destinatariosDisponibles(caso);
  const { subject, text } = asuntoYCuerpo(tipo, caso);

  const enviados: string[] = [];
  const fallidos: { destinatario: string; error: string }[] = [];

  for (const destinatario of pedidosValidos) {
    const email = disponibles[destinatario];
    if (!email) {
      fallidos.push({ destinatario, error: "No tiene mail cargado." });
      continue;
    }
    const resultado = await enviarEmail({ to: email, subject, text });
    if (resultado.ok) {
      enviados.push(destinatario);
    } else {
      fallidos.push({ destinatario, error: resultado.error ?? "No se pudo enviar." });
    }
  }

  return NextResponse.json({ enviados, fallidos });
}
