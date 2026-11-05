import { describe, expect, it } from "vitest";
import { categoriasPara } from "../documentosCategorias";
import { esBajaDigital, nombreFormularioBaja, usaAnexo04 } from "../tipoBaja";

describe("04 Digital", () => {
  it("el formulario es el IPV y no hay Anexo 04", () => {
    expect(esBajaDigital("04 Digital")).toBe(true);
    expect(nombreFormularioBaja("04 Digital")).toBe("Instrumento de Petición Virtual (IPV)");
    expect(usaAnexo04("04 Digital")).toBe(false);
  });
  it("las demás bajas siguen con formulario/04D y Anexo 04", () => {
    for (const t of ["04D", "04C", "Baja por robo", null, undefined]) {
      expect(esBajaDigital(t)).toBe(false);
      expect(nombreFormularioBaja(t)).toBe("formulario/04D");
      expect(usaAnexo04(t)).toBe(true);
    }
  });
  it("la categoría de documentos se rotula IPV solo en 04 Digital", () => {
    expect(categoriasPara("04 Digital").find((c) => c.value === "formulario_baja")?.label).toContain("IPV");
    expect(categoriasPara("04D").find((c) => c.value === "formulario_baja")?.label).toBe("Formulario de baja");
    expect(categoriasPara("04 Digital")).toHaveLength(3);
  });
});
