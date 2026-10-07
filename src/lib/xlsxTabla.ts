import ExcelJS from "exceljs";

// Exportación genérica a Excel (.xlsx) para todos los reportes tabulares.
// A diferencia del CSV, el .xlsx guarda cada celda con su tipo: los
// identificadores (siniestros, dominios, DNI, comprobantes) quedan como
// texto —sin perder ceros ni pasar a notación científica—, las fechas son
// fechas reales y los importes números, y las observaciones con saltos de
// línea no cortan filas.

export type TipoColumna = "texto" | "fecha" | "fechahora" | "numero" | "moneda" | "porcentaje";

export interface ColumnaXlsx {
  key: string;
  label: string;
  ancho?: number;
  tipo?: TipoColumna;
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function aFecha(valor: unknown, conHora: boolean): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const s = String(valor);
  if (!conHora || s.length <= 10) {
    const [a, m, d] = s.slice(0, 10).split("-").map(Number);
    if (!a || !m || !d) return null;
    return new Date(Date.UTC(a, m - 1, d));
  }
  const f = new Date(s);
  return isNaN(f.getTime()) ? null : f;
}

function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return isNaN(n) ? null : n;
}

export function valorCelda(tipo: TipoColumna | undefined, valor: unknown): unknown {
  switch (tipo) {
    case "texto":
      return valor === null || valor === undefined ? "" : String(valor);
    case "fecha":
      return aFecha(valor, false);
    case "fechahora":
      return aFecha(valor, true);
    case "numero":
    case "moneda":
    case "porcentaje":
      return aNumero(valor) ?? (typeof valor === "string" && valor ? valor : null);
    default:
      return valor === undefined ? null : valor;
  }
}

function anchoPorDefecto(col: ColumnaXlsx): number {
  if (col.ancho) return col.ancho;
  switch (col.tipo) {
    case "fecha":
      return 13;
    case "fechahora":
      return 18;
    case "moneda":
    case "numero":
      return 16;
    default:
      return Math.max(12, Math.min(40, col.label.length + 4));
  }
}

// Arma un libro de una sola hoja con encabezado destacado, filtros y la
// primera fila fija.
export async function generarXlsxTabla(
  nombreHoja: string,
  columnas: ColumnaXlsx[],
  filas: Record<string, unknown>[]
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();
  const hoja = libro.addWorksheet(nombreHoja.slice(0, 31));
  hoja.columns = columnas.map((c) => ({ header: c.label, key: c.key, width: anchoPorDefecto(c) }));

  const cab = hoja.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
  cab.alignment = { vertical: "middle", wrapText: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  columnas.forEach((col, i) => {
    const columna = hoja.getColumn(i + 1);
    if (col.tipo === "texto") columna.numFmt = "@";
    else if (col.tipo === "fecha") columna.numFmt = "dd/mm/yyyy";
    else if (col.tipo === "fechahora") columna.numFmt = "dd/mm/yyyy hh:mm";
    else if (col.tipo === "moneda") columna.numFmt = "#,##0.00;[Red]-#,##0.00";
    else if (col.tipo === "porcentaje") columna.numFmt = "0.00";
  });

  for (const f of filas) {
    const valores: Record<string, unknown> = {};
    for (const col of columnas) valores[col.key] = valorCelda(col.tipo, f[col.key]);
    hoja.addRow(valores);
  }

  if (columnas.length > 0) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  }
  return Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}

export function xlsxResponse(buffer: Buffer, nombreArchivo: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`
    }
  });
}

// Pagina una consulta de PostgREST (corta cada respuesta en 1000 filas).
export async function traerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error?: { message: string } | null }>
): Promise<T[]> {
  const TAM = 1000;
  const todo: T[] = [];
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await pagina(desde, desde + TAM - 1);
    if (error) throw new Error(error.message);
    todo.push(...(data ?? []));
    if (!data || data.length < TAM) break;
  }
  return todo;
}
