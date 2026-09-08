// Parser de CSV simple (RFC4180-ish): campos entre comillas, comillas
// escapadas como "", separador coma, filas separadas por \r\n o \n.
// Alcanza para archivos armados a mano en Excel/Sheets a partir de la
// plantilla de importación — no es un parser CSV genérico de propósito
// general.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // El BOM de UTF-8 que agrega Excel al guardar CSV rompería el primer
  // encabezado si no se saca.
  const clean = text.replace(/^﻿/, "");

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // ignorado, \n cierra la fila
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

// Convierte las filas parseadas en objetos usando la primera fila como
// encabezado, matcheando por nombre de columna (no por posición) — así
// el orden de columnas en la plantilla no es crítico.
export function csvRowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? "").trim();
    });
    return obj;
  });
}
