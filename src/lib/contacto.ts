// Datos de contacto comercial de Oltra para la portada pública (/).
// Un solo lugar para cambiarlos cuando haga falta.

// Formato internacional sin signos: país (54) + 9 + código de área sin 0 +
// número sin 15.
export const WHATSAPP_NUMERO = "5491166205928";
export const WHATSAPP_VISIBLE = "+54 9 11 6620-5928";
export const EMAIL_CONTACTO = "oltra.gestion.integral@gmail.com";
export const HORARIO_ATENCION = "Lunes a viernes, de 08 a 17 hs";
export const ZONA_DE_TRABAJO = "CABA";

export function whatsappUrl(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
}
