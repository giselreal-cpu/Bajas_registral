import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { registrarCambio } from "@/lib/historial";
import { enviarEmail } from "@/lib/email/enviarEmail";
import { normalizarEmails } from "@/lib/email/notificacionesCaso";
import {
  DatosSeguimiento,
  mailSeguimiento,
  observacionesPublicas,
  ultimaObservacionPublica
} from "@/lib/seguimientoProductor";

// Arma el seguimiento del caso para el productor: destinatarios (los mails
// cargados en "Contacto de productor", puede haber varios) y el mail.
async function armar(casoId: string) {
  const supabase = createClient();
  const { data: caso, error } = await supabase
    .from("casos")
    .select(
      `
      id, numero_siniestro, estado, rama, deuda_patentes, deuda_multas, gestor_id, productor_contacto,
      aseguradora:aseguradoras(nombre),
      asegurado:asegurados(nombre),
      vehiculo:vehiculos(dominio),
      tipo_baja:tipos_baja(nombre),
      responsable:usuarios!responsable_id(nombre, email)
    `
    )
    .eq("id", casoId)
    .maybeSingle();
  if (error || !caso) return { error: "Caso no encontrado.", status: 404 as const };

  const { data: eventos } = await supabase
    .from("bitacora")
    .select("tipo_evento, completado, fecha_inicio, fecha_fin, es_interna, observacion")
    .eq("caso_id", casoId);

  // Anulado: consulta aparte (tolera que la migración no esté aplicada).
  const { data: anul } = await supabase.from("casos").select("anulado").eq("id", casoId).maybeSingle();

  const c = caso as unknown as {
    numero_siniestro: string;
    estado: string;
    rama: string | null;
    deuda_patentes: number | null;
    deuda_multas: number | null;
    gestor_id: string | null;
    productor_contacto: string | null;
    aseguradora: { nombre: string } | null;
    asegurado: { nombre: string } | null;
    vehiculo: { dominio: string } | null;
    tipo_baja: { nombre: string } | null;
    responsable: { nombre: string; email: string | null } | null;
  };

  const datos: DatosSeguimiento = {
    numero_siniestro: c.numero_siniestro,
    dominio: c.vehiculo?.dominio ?? "s/d",
    aseguradora: c.aseguradora?.nombre ?? "s/d",
    asegurado: c.asegurado?.nombre ?? "s/d",
    tipo_baja: c.tipo_baja?.nombre ?? null,
    rama: c.rama,
    estado: c.estado,
    anulado: !!(anul as { anulado?: boolean } | null)?.anulado,
    deuda_patentes: c.deuda_patentes,
    deuda_multas: c.deuda_multas,
    tieneGestor: !!c.gestor_id,
    responsable: c.responsable,
    eventos: (eventos ?? []) as DatosSeguimiento["eventos"]
  };

  const destinatarios = normalizarEmails(c.productor_contacto);
  return { datos, destinatarios };
}

// GET -> datos para la vista previa (la pantalla arma el mail con ellos) y a
// quién se enviaría. Las observaciones no viajan: solo si hay públicas y cuál
// es la última, para ofrecerla como novedad.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }
  const r = await armar(params.id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const ultima = ultimaObservacionPublica(r.datos.eventos);
  return NextResponse.json({
    destinatarios: r.destinatarios,
    datos: { ...r.datos, eventos: r.datos.eventos.map((e) => ({ ...e, observacion: null })) },
    ultimaObservacion: ultima?.texto ?? null,
    hayObservaciones: observacionesPublicas(r.datos.eventos).length > 0
  });
}

// POST { novedad?: string } -> envía el seguimiento a los mails del productor.
// `novedad` es el texto que una persona revisó y aprobó en pantalla; el
// servidor nunca agrega observaciones por su cuenta.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const novedad = typeof body.novedad === "string" ? body.novedad.trim().slice(0, 2000) : "";
  const r = await armar(params.id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.datos.anulado) return NextResponse.json({ error: "El caso está anulado." }, { status: 409 });
  if (r.destinatarios.length === 0) {
    return NextResponse.json({ error: "El caso no tiene mail de productor cargado." }, { status: 400 });
  }

  const mail = mailSeguimiento(r.datos, { novedad });
  const resultado = await enviarEmail({ to: r.destinatarios.join(", "), subject: mail.subject, text: mail.text });
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error ?? "No se pudo enviar el mail." }, { status: 502 });
  }
  await registrarCambio(
    params.id,
    "Envió el seguimiento al productor",
    `${r.destinatarios.join(", ")}${novedad ? " (con novedad)" : ""}`
  );
  return NextResponse.json({ ok: true, destinatarios: r.destinatarios });
}
