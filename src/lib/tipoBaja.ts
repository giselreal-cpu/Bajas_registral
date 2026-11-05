// Particularidades del tipo de baja "04 Digital": el formulario que completa y
// adjunta el desarmadero es el Instrumento de Petición Virtual (IPV), que ya
// trae integrada la generación de piezas — por eso en esta modalidad no hay
// Anexo 04.

export const TIPO_BAJA_DIGITAL = "04 Digital";
export const NOMBRE_IPV = "Instrumento de Petición Virtual (IPV)";

export function esBajaDigital(nombreTipoBaja: string | null | undefined): boolean {
  return nombreTipoBaja === TIPO_BAJA_DIGITAL;
}

// Nombre del formulario que se pide en el evento "Formulario de Baja".
export function nombreFormularioBaja(nombreTipoBaja: string | null | undefined): string {
  return esBajaDigital(nombreTipoBaja) ? NOMBRE_IPV : "formulario/04D";
}

// El Anexo 04 (Piezas RUDAC) no aplica a las bajas digitales.
export function usaAnexo04(nombreTipoBaja: string | null | undefined): boolean {
  return !esBajaDigital(nombreTipoBaja);
}
