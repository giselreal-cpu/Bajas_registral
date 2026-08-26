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

// Mensaje de la encuesta de satisfacción: a pedido explícito del
// usuario, las 3 preguntas van visibles en el propio texto (no solo
// "completá esta encuesta" genérico) — cada una apunta a una etapa
// distinta del proceso para que el dato sirva para saber qué mejorar.
export function mensajeEncuesta(datos: DatosEncuesta, enlace: string): string {
  return `Hola ${datos.asegurado}, en Oltra Gestión Integral buscamos mejorar cada día. Nos encantaría conocer tu opinión sobre el proceso de baja de tu vehículo dominio ${datos.dominio} (Siniestro N° ${datos.numeroSiniestro}):

1️⃣ ¿La información que recibiste en el primer contacto fue clara y completa?
2️⃣ ¿Cómo calificarías la atención y puntualidad durante el traslado de tu vehículo?
3️⃣ ¿Qué tan conforme estás con el asesoramiento y acompañamiento de la gestoría durante todo el trámite?

Completá esta breve encuesta (1 minuto) y contanos tu experiencia: ${enlace}

¡Gracias por tu tiempo!`;
}
