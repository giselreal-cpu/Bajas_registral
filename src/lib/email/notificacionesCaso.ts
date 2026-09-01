import { CasoConRelaciones } from "@/types/database";

export type TipoNotificacion =
  | "ingreso_caso"
  | "contacto_asegurado"
  | "gestor_asignado"
  | "traslado"
  | "presentacion_baja";

export type Destinatario = "tramitador" | "productor" | "asegurado";

export const DESTINATARIOS: { value: Destinatario; label: string }[] = [
  { value: "tramitador", label: "Tramitador" },
  { value: "productor", label: "Productor" },
  { value: "asegurado", label: "Asegurado" }
];

// El mail del productor usa el campo "Contacto de productor" tal cual (es
// texto libre, no siempre va a ser un mail válido) — decisión explícita
// del usuario, sin agregar una columna nueva.
export function destinatariosDisponibles(
  caso: CasoConRelaciones
): Record<Destinatario, string | null> {
  return {
    tramitador: caso.tramitador_email || null,
    productor: caso.productor_contacto || null,
    asegurado: caso.asegurado?.email || null
  };
}

const TITULOS: Record<TipoNotificacion, string> = {
  ingreso_caso: "Inicio de trámite",
  contacto_asegurado: "Contacto con el asegurado",
  gestor_asignado: "Gestor de campo asignado",
  traslado: "Traslado de la unidad",
  presentacion_baja: "Baja presentada en el registro"
};

export function asuntoYCuerpo(
  tipo: TipoNotificacion,
  caso: CasoConRelaciones
): { subject: string; text: string } {
  const dominio = caso.vehiculo?.dominio ?? "s/d";
  const numero = caso.numero_siniestro;
  const aseguradora = caso.aseguradora?.nombre ?? "s/d";
  const nombreAsegurado = caso.asegurado?.nombre ?? "s/d";
  const gestor = caso.gestor?.nombre ?? "s/d";
  const formatMoneda = (valor: number | null) =>
    (valor ?? 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

  const subject = `Siniestro ${numero} · Dominio ${dominio} · ${aseguradora} — ${TITULOS[tipo]}`;

  const cuerpos: Record<TipoNotificacion, string> = {
    ingreso_caso: `Le informamos que se dio inicio al trámite de baja registral del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}, asegurado ${nombreAsegurado}).`,
    contacto_asegurado: `Le informamos que se contactó al asegurado ${nombreAsegurado} para coordinar los próximos pasos de la baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}). Se comunicó estado de multas por ${formatMoneda(
      caso.deuda_multas
    )} y patentes por ${formatMoneda(caso.deuda_patentes)}.`,
    gestor_asignado: `Le informamos que se asignó un gestor de campo (${gestor}) para continuar los trámites de la baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}).`,
    traslado: `Le informamos que se trasladó la unidad dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}) hacia el desarmadero asignado.`,
    presentacion_baja: `Le informamos que se presentó la baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}) en el registro automotor.`
  };

  const text = `Hola,\n\n${cuerpos[tipo]}\n\nSaludos,\nOltra Gestión Integral`;

  return { subject, text };
}
