// Validación de fechas cargadas a mano (AAAA-MM-DD). Un año mal tipeado
// ("23/10/6" queda como el año 6) genera fechas imposibles que rompen los
// tiempos de trámite y los reportes, así que se rechazan en el servidor.

export const ANIO_MINIMO = 2000;
export const ANIO_MAXIMO = 2100;

export function fechaRazonable(valor: unknown): boolean {
  if (typeof valor !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.slice(0, 10));
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) return false;
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
}

// Devuelve el mensaje de error si alguno de los campos presentes (no vacíos)
// tiene una fecha inválida, o null si están bien.
export function errorDeFechas(campos: Record<string, unknown>): string | null {
  for (const [nombre, valor] of Object.entries(campos)) {
    if (valor === undefined || valor === null || valor === "") continue;
    if (!fechaRazonable(valor)) {
      return `La fecha de "${nombre}" no es válida (revisá el año): ${String(valor)}.`;
    }
  }
  return null;
}
