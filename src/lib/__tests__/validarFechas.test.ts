import { describe, expect, it } from "vitest";
import { errorDeFechas, fechaRazonable } from "../validarFechas";

describe("validarFechas", () => {
  it("acepta fechas normales y rechaza años mal tipeados o fechas imposibles", () => {
    expect(fechaRazonable("2026-10-23")).toBe(true);
    expect(fechaRazonable("0006-10-23")).toBe(false);
    expect(fechaRazonable("0026-09-22")).toBe(false);
    expect(fechaRazonable("2026-02-30")).toBe(false);
    expect(fechaRazonable("23/10/2026")).toBe(false);
  });
  it("ignora los campos vacíos y nombra el campo inválido", () => {
    expect(errorDeFechas({ fecha_inicio: "2026-10-01", fecha_fin: "" })).toBeNull();
    expect(errorDeFechas({ fecha_fin: undefined })).toBeNull();
    expect(errorDeFechas({ fecha_fin: "0006-10-23" })).toContain("fecha_fin");
  });
});
