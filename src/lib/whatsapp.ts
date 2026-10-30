// Helpers de WhatsApp compartidos entre BitacoraSection (gruero,
// formulario de baja, encuesta) y el dashboard de encuestas del Panel
// (botón de reenvío de recordatorio) — antes vivía solo dentro de
// BitacoraSection.tsx.

// wa.me necesita el número en formato internacional sin signos. Es un
// mejor esfuerzo (no siempre acierta el prefijo "9" de celulares
// argentinos) — por eso también se ofrece "Copiar mensaje" como respaldo.
export function linkWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  if (!telefono) return null;
  let digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  if (!digitos.startsWith("54")) digitos = `54${digitos}`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

export interface DatosEncuesta {
  asegurado: string;
  dominio: string;
  numeroSiniestro: string;
}

// Mensaje al titular cuando termina la baja: le avisa que ya se notificó a
// la compañía (desde ahí corre el tiempo de gestión de la aseguradora para el
// pago del siniestro, sin prometer plazos) y lo invita a la encuesta de
// satisfacción. Las 3 preguntas puntuales (contacto inicial, traslado,
// gestoría) se responden dentro del link, no van en el mensaje. Con
// `recordatorio` se usa una versión corta para quien no respondió todavía.
export function mensajeEncuesta(datos: DatosEncuesta, enlace: string, recordatorio = false): string {
  if (recordatorio) {
    return `Hola ${datos.asegurado}, te escribimos nuevamente por la baja de tu vehículo dominio ${datos.dominio} (Siniestro N° ${datos.numeroSiniestro}). Tu opinión nos ayuda a mejorar: completá esta breve encuesta (1 minuto) y contanos cómo fue tu experiencia: ${enlace}

¡Muchas gracias!`;
  }
  return `Hola ${datos.asegurado}, te informamos que la baja de tu vehículo dominio ${datos.dominio} (Siniestro N° ${datos.numeroSiniestro}) ya está finalizada y la compañía de seguros fue notificada: a partir de ahora comienza su tiempo de gestión para el pago del siniestro.

En Oltra Gestión Integral buscamos mejorar cada día y tu opinión es muy valiosa. ¿Nos contás cómo fue tu experiencia? Completá esta breve encuesta (1 minuto): ${enlace}

¡Gracias por confiar en nosotros!`;
}
