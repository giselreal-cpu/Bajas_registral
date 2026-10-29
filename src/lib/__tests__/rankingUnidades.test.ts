import { describe, expect, it } from "vitest";
import { modeloBase, rankingUnidades } from "../rankingUnidades";

describe("rankingUnidades", () => {
  it("agrupa por el modelo base y comparte la posición en los empates", () => {
    const u = [
      { marca: "Ford", modelo: "ECOSPORT 1.6 L 4X2 XLS", anio: 2011 },
      { marca: "FORD", modelo: "ECOSPORT 2.0 TITANIUM", anio: 2011 },
      { marca: "FORD", modelo: "Fiesta 1.6L S", anio: 2017 },
      { marca: "VOLKSWAGEN", modelo: "GOL TREND", anio: 2015 },
      { marca: "VOLKSWAGEN", modelo: "GOL POWER", anio: 2016 }
    ];
    const completo = rankingUnidades(u, "marca_modelo_anio");
    expect(completo[0]).toMatchObject({ posicion: 1, marca: "FORD", modelo: "ECOSPORT", anio: 2011, casos: 2 });
    expect(completo.map((f) => f.posicion)).toEqual([1, 2, 2, 2]);

    const porMarcaModelo = rankingUnidades(u, "marca_modelo");
    expect(porMarcaModelo.find((f) => f.modelo === "GOL")?.casos).toBe(2);

    const porMarca = rankingUnidades(u, "marca");
    expect(porMarca.map((f) => [f.marca, f.casos])).toEqual([
      ["FORD", 3],
      ["VOLKSWAGEN", 2]
    ]);
  });

  it("toma dos palabras con prefijos como GRAND y tolera datos faltantes", () => {
    expect(modeloBase("Grand Siena Essence 1.6")).toBe("GRAND SIENA");
    expect(modeloBase("  fit   lx ")).toBe("FIT");
    expect(modeloBase(null)).toBe("SIN MODELO");
    const r = rankingUnidades([{ marca: null, modelo: null, anio: null }], "marca_modelo_anio");
    expect(r[0]).toMatchObject({ marca: "SIN MARCA", modelo: "SIN MODELO", anio: null });
  });
});
