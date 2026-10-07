import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarXlsxTabla } from "../xlsxTabla";

async function leer(buffer: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  return libro.worksheets[0];
}

describe("generarXlsxTabla", () => {
  it("guarda identificadores como texto, fechas como fecha e importes como número", async () => {
    const buffer = await generarXlsxTabla(
      "Prueba",
      [
        { key: "caso", label: "Caso", tipo: "texto" },
        { key: "fecha", label: "Fecha", tipo: "fecha" },
        { key: "monto", label: "Monto", tipo: "moneda" },
        { key: "obs", label: "Observación" }
      ],
      [
        { caso: "0012345678901", fecha: "2026-09-25", monto: "88900", obs: "Línea 1\nLínea 2\n" },
        { caso: "AB123CD", fecha: "", monto: "", obs: "" }
      ]
    );
    const hoja = await leer(buffer);
    expect(hoja.rowCount).toBe(3);
    expect(hoja.getCell("A2").value).toBe("0012345678901");
    expect((hoja.getCell("B2").value as Date).toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(hoja.getCell("C2").value).toBe(88900);
    expect(hoja.getCell("D2").value).toBe("Línea 1\nLínea 2\n");
    expect(hoja.getCell("B3").value).toBeNull();
    expect(hoja.getCell("C3").value).toBeNull();
  });
});
