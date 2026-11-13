// Calendario laboral argentino: días hábiles = lunes a viernes que no son
// feriados nacionales. Los feriados se calculan por regla (los fijos, los
// trasladables según la ley 27.399 y los que dependen de la Pascua), así
// funciona para cualquier año sin cargar una tabla.
//
// No incluye los "días no laborables con fines turísticos" (puentes) ni los
// feriados que el Gobierno agrega o mueve por decreto en un año puntual: esos
// se suman a mano en FERIADOS_EXTRA.

// Fechas (AAAA-MM-DD) para agregar o corregir por decreto, por año.
const FERIADOS_EXTRA: Record<number, string[]> = {};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (anio: number, mes: number, dia: number) => `${anio}-${pad(mes)}-${pad(dia)}`;

// Día de la semana (0 = domingo) de una fecha AAAA-MM-DD.
function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return ymd(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
}

// Domingo de Pascua (algoritmo gregoriano).
function pascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(anio, mes, dia);
}

// Feriados trasladables (ley 27.399): martes o miércoles pasan al lunes
// anterior; jueves o viernes, al lunes siguiente; el resto no se mueve.
function trasladable(fecha: string): string {
  const dia = diaSemana(fecha);
  if (dia === 2 || dia === 3) return sumarDias(fecha, -(dia - 1));
  if (dia === 4 || dia === 5) return sumarDias(fecha, 8 - dia);
  return fecha;
}

const cache = new Map<number, Set<string>>();

export function feriadosArgentina(anio: number): Set<string> {
  const guardado = cache.get(anio);
  if (guardado) return guardado;

  const p = pascua(anio);
  const lista = [
    // Inamovibles
    ymd(anio, 1, 1), // Año Nuevo
    ymd(anio, 3, 24), // Día de la Memoria
    ymd(anio, 4, 2), // Día de las Malvinas
    ymd(anio, 5, 1), // Día del Trabajador
    ymd(anio, 5, 25), // Revolución de Mayo
    ymd(anio, 6, 20), // Día de la Bandera
    ymd(anio, 7, 9), // Día de la Independencia
    ymd(anio, 12, 8), // Inmaculada Concepción
    ymd(anio, 12, 25), // Navidad
    // Trasladables
    trasladable(ymd(anio, 6, 17)), // Güemes
    trasladable(ymd(anio, 8, 17)), // San Martín
    trasladable(ymd(anio, 10, 12)), // Diversidad Cultural
    trasladable(ymd(anio, 11, 20)), // Soberanía Nacional
    // Según la Pascua
    sumarDias(p, -48), // Carnaval (lunes)
    sumarDias(p, -47), // Carnaval (martes)
    sumarDias(p, -2), // Viernes Santo
    ...(FERIADOS_EXTRA[anio] ?? [])
  ];
  const set = new Set(lista);
  cache.set(anio, set);
  return set;
}

export function esFeriado(fecha: string): boolean {
  return feriadosArgentina(Number(fecha.slice(0, 4))).has(fecha);
}

export function esDiaHabil(fecha: string): boolean {
  const dia = diaSemana(fecha);
  return dia !== 0 && dia !== 6 && !esFeriado(fecha);
}

// Fecha (AAAA-MM-DD) en horario de Argentina. Un string solo con fecha se
// devuelve tal cual.
export function fechaArgentina(valor: string | Date): string {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const f = typeof valor === "string" ? new Date(valor) : valor;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(f);
  return partes; // en-CA => AAAA-MM-DD
}

// Días hábiles transcurridos entre dos fechas: cuenta los días hábiles que hay
// después de `desde` hasta `hasta` inclusive (sin contar sábados, domingos ni
// feriados). Si `hasta` no es posterior a `desde`, es 0.
export function diasHabilesTranscurridos(desde: string | Date, hasta: string | Date): number {
  const inicio = fechaArgentina(desde);
  const fin = fechaArgentina(hasta);
  let cantidad = 0;
  let cursor = sumarDias(inicio, 1);
  // Tope de seguridad: ~10 años.
  for (let i = 0; cursor <= fin && i < 3700; i++) {
    if (esDiaHabil(cursor)) cantidad++;
    cursor = sumarDias(cursor, 1);
  }
  return cantidad;
}
