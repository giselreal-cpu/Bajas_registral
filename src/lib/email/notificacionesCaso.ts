import { CasoConRelaciones } from "@/types/database";
import { esSoloInformes } from "@/lib/eventosBitacora";

export type TipoNotificacion =
  | "ingreso_caso"
  | "peticion_informes"
  | "contacto_asegurado"
  | "gestor_asignado"
  | "traslado"
  | "presentacion_baja"
  | "cierre_caso";

export type Destinatario = "tramitador" | "productor" | "asegurado" | "reposicion";

export const DESTINATARIOS: { value: Destinatario; label: string }[] = [
  { value: "tramitador", label: "Tramitador" },
  { value: "productor", label: "Productor" },
  { value: "asegurado", label: "Asegurado" },
  { value: "reposicion", label: "Proveedor de reposición" }
];

// La compañía necesita el "Informe de dominio" como comprobante del estado de
// la unidad (para pagar): al avisar que se contactó al asegurado o que se
// cerró la petición de informes, el mail lo lleva adjunto. Solo para quienes
// están del lado de la compañía (tramitador y productor): el asegurado y el
// proveedor de reposición no lo reciben.
export const TIPOS_CON_INFORME_DOMINIO: TipoNotificacion[] = ["contacto_asegurado", "peticion_informes"];
export const DESTINATARIOS_CON_INFORME_DOMINIO: Destinatario[] = ["tramitador", "productor"];

// El aviso de contacto con el asegurado lleva el informe si y solo si el evento
// "Petición de Informes" ya está completado; si no, se manda solo el aviso y el
// informe queda pendiente (va con el aviso de "Petición de Informes" cuando se
// complete). El aviso de "Petición de Informes" siempre lo lleva.
export function llevaInformeDominio(
  tipo: TipoNotificacion,
  destinatario: Destinatario,
  peticionInformesCompleta = true
): boolean {
  if (tipo === "contacto_asegurado" && !peticionInformesCompleta) return false;
  return TIPOS_CON_INFORME_DOMINIO.includes(tipo) && DESTINATARIOS_CON_INFORME_DOMINIO.includes(destinatario);
}

// Los mails de un proveedor se cargan separados por coma: se normalizan y se
// descartan los que no parecen una dirección.
export function normalizarEmails(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

// El mail del productor usa el campo "Contacto de productor" tal cual (es
// texto libre, no siempre va a ser un mail válido) — decisión explícita
// del usuario, sin agregar una columna nueva.
export function destinatariosDisponibles(
  caso: CasoConRelaciones
): Record<Destinatario, string | null> {
  return {
    tramitador: caso.tramitador_email || null,
    productor: caso.productor_contacto || null,
    asegurado: caso.asegurado?.email || null,
    reposicion: normalizarEmails(caso.proveedor_reposicion?.emails).join(", ") || null
  };
}

const TITULOS: Record<TipoNotificacion, string> = {
  ingreso_caso: "Inicio de trámite",
  peticion_informes: "Informes de dominio",
  contacto_asegurado: "Contacto con el asegurado",
  gestor_asignado: "Gestor de campo asignado",
  traslado: "Traslado de la unidad",
  presentacion_baja: "Presentación de la baja finalizada",
  cierre_caso: "Caso cerrado"
};

export const TEXTO_INFORME_ADJUNTO =
  "Adjuntamos el informe de dominio, como comprobante del estado de la unidad.";

export function asuntoYCuerpo(
  tipo: TipoNotificacion,
  caso: CasoConRelaciones,
  destinatario?: Destinatario,
  // `conInformeAdjunto`: el mail lleva el informe de dominio como archivo.
  // `enlacesInforme`: informes que no se pudieron adjuntar y van como enlace.
  opciones: { conInformeAdjunto?: boolean; enlacesInforme?: string[] } = {}
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
    ingreso_caso: esSoloInformes(caso.tipo_baja?.nombre)
      ? `Le informamos que se dio inicio al trámite de Pedido de Informes del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}, asegurado ${nombreAsegurado}). El registro es quien emite el informe de dominio histórico, lo cual suele demorar entre 48/72hs hábiles en emitirlo.`
      : `Le informamos que se dio inicio al trámite de baja registral del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}, asegurado ${nombreAsegurado}). Como primer paso solicitaremos los informes de dominio para conocer la situación registral de la unidad, y nos comunicaremos dentro de las próximas 24 hs hábiles para detallarle el procedimiento a seguir.`,
    peticion_informes: `Le informamos que se completó el pedido de informes del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}, asegurado ${nombreAsegurado}).`,
    contacto_asegurado: `Le informamos que se contactó al asegurado ${nombreAsegurado} para coordinar los próximos pasos de la baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}). Se comunicó estado de multas por ${formatMoneda(
      caso.deuda_multas
    )} y patentes por ${formatMoneda(caso.deuda_patentes)}.`,
    gestor_asignado: `Le informamos que se asignó un gestor de campo (${gestor}) para continuar los trámites de la baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}). Este tomará contacto con el asegurado o asegurada a la brevedad, y continuará con el proceso de presentación de la baja ante el registro automotor de radicación.`,
    traslado: `Le informamos que se trasladó la unidad dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}) hacia el desarmadero asignado.`,
    presentacion_baja: `Le informamos que ha finalizado la presentación de la baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}) en el registro automotor. Con este paso se completa la gestión de la baja ante el registro. Cualquier trámite posterior, como la baja de patentes, se informará por separado. Quedamos a disposición ante cualquier consulta.`,
    cierre_caso: `Le informamos que se cerró el caso de baja del vehículo dominio ${dominio} (Siniestro N° ${numero}, ${aseguradora}). La documentación de la baja ya fue enviada a la compañía.`
  };

  // El proveedor de reposición negocia la unidad con el asegurado: recibe
  // sus datos de contacto.
  const contacto =
    destinatario === "reposicion"
      ? `\n\nDatos del asegurado:\nNombre: ${nombreAsegurado}\nTeléfono: ${caso.asegurado?.telefono || "s/d"}\nEmail: ${caso.asegurado?.email || "s/d"}`
      : "";

  const enlaces = opciones.enlacesInforme ?? [];
  const adjunto = opciones.conInformeAdjunto ? ` ${TEXTO_INFORME_ADJUNTO}` : "";
  const textoEnlaces =
    enlaces.length > 0
      ? `\n\n${enlaces.length === 1 ? "Informe de dominio" : "Informes de dominio"} (comprobante del estado de la unidad):\n${enlaces.join("\n")}`
      : "";
  const text = `Hola,\n\n${cuerpos[tipo]}${adjunto}${textoEnlaces}${contacto}\n\nSaludos,\nOltra Gestión Integral`;

  return { subject, text };
}
