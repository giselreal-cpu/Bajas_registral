// Ranking de unidades (marca / modelo / año) de los casos ingresados.
//
// El modelo de cada vehículo se carga con la descripción completa de
// InfoAuto ("ECOSPORT 1.6 L 4X2 XLS", "FIT LX"), así que agrupar por el texto
// exacto dejaría casi todos los renglones con 1 caso y el ranking no serviría.
// Se usa el modelo "base": la primera palabra de la descripción (o las dos
// primeras cuando empieza con un prefijo como GRAND o NEW).

const PREFIJOS_DE_DOS_PALABRAS = new Set(["GRAND", "NEW", "ALL", "SANTA", "MINI", "RANGE", "LAND", "CITY", "NUEVO"]);

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizarMarca(marca: string | null | undefined): string {
  const limpia = sinAcentos((marca ?? "").trim()).replace(/\s+/g, " ").toUpperCase();
  return limpia || "SIN MARCA";
}

export function modeloBase(modelo: string | null | undefined): string {
  const palabras = sinAcentos((modelo ?? "").trim()).replace(/\s+/g, " ").toUpperCase().split(" ").filter(Boolean);
  if (palabras.length === 0) return "SIN MODELO";
  if (palabras.length > 1 && PREFIJOS_DE_DOS_PALABRAS.has(palabras[0])) {
    return `${palabras[0]} ${palabras[1]}`;
  }
  return palabras[0];
}

export interface UnidadCaso {
  marca: string | null;
  modelo: string | null;
  anio: number | null;
}

export interface FilaRanking {
  posicion: number;
  marca: string;
  modelo: string | null; // null en el ranking por marca
  anio: number | null; // null cuando no se agrupa por año
  casos: number;
}

type Agrupacion = "marca" | "marca_modelo" | "marca_modelo_anio";

// Agrupa y ordena por cantidad de casos (de mayor a menor). Los empates
// comparten posición (1, 2, 2, 4...) y se ordenan alfabéticamente.
export function rankingUnidades(unidades: UnidadCaso[], agrupacion: Agrupacion): FilaRanking[] {
  const grupos = new Map<string, Omit<FilaRanking, "posicion">>();
  for (const u of unidades) {
    const marca = normalizarMarca(u.marca);
    const modelo = agrupacion === "marca" ? null : modeloBase(u.modelo);
    const anio = agrupacion === "marca_modelo_anio" ? (u.anio ?? null) : null;
    const clave = `${marca}|${modelo ?? ""}|${anio ?? ""}`;
    const actual = grupos.get(clave);
    if (actual) actual.casos += 1;
    else grupos.set(clave, { marca, modelo, anio, casos: 1 });
  }

  const ordenadas = Array.from(grupos.values()).sort(
    (a, b) =>
      b.casos - a.casos ||
      a.marca.localeCompare(b.marca) ||
      (a.modelo ?? "").localeCompare(b.modelo ?? "") ||
      (b.anio ?? 0) - (a.anio ?? 0)
  );

  let posicion = 0;
  let anterior = -1;
  return ordenadas.map((f, i) => {
    if (f.casos !== anterior) {
      posicion = i + 1;
      anterior = f.casos;
    }
    return { ...f, posicion };
  });
}
