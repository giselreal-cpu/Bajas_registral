import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";

const COLS = [
  { key: "a", label: "A" },
  { key: "b", label: "B" }
];

describe("toCsv", () => {
  it("cada registro queda en una sola línea aunque la observación tenga saltos de línea", () => {
    const csv = toCsv(
      [
        { a: "JAP738", b: "Se oferto en Licitación $ 1.520.000\n" },
        { a: "KUT662", b: "\t\nPrecarga Nro. 96056893" },
        { a: "AF422YH", b: "Valor, con coma y \"comillas\"" }
      ],
      COLS
    ).replace("﻿", "");
    const lineas = csv.split("\r\n");
    expect(lineas).toHaveLength(4);
    expect(lineas[1]).toBe("JAP738,Se oferto en Licitación $ 1.520.000");
    expect(lineas[2]).toBe("KUT662,Precarga Nro. 96056893");
    expect(lineas[3]).toBe('AF422YH,"Valor, con coma y ""comillas"""');
  });
});
