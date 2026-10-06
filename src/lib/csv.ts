// Utilitario simple para generar CSV a partir de un array de objetos.
// Evita traer una librería extra solo para esto.

export interface CsvColumn {
  key: string;
  label: string;
}

// Los saltos de línea y tabulaciones dentro de una celda (por ejemplo una
// observación con un Enter al final) hacen que Excel deje de leer todas las
// filas que vienen después — se perdían casos en el reporte sin ningún
// aviso. Se colapsan a un espacio para que cada registro sea siempre una
// sola línea.
function limpiarCelda(texto: string): string {
  return texto.replace(/\s*[\r\n]+\s*/g, " ").replace(/\t/g, " ").trim();
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = limpiarCelda(String(value));
  if (str.includes(",") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(",")
  );
  // BOM al inicio para que Excel reconozca bien los acentos en UTF-8.
  return "\uFEFF" + [header, ...lines].join("\r\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
