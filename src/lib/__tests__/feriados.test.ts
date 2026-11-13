import { describe, expect, it } from "vitest";
import { diasHabilesTranscurridos, esDiaHabil, feriadosArgentina } from "../feriados";

describe("feriados argentinos", () => {
  it("calcula los feriados de 2026", () => {
    const f = feriadosArgentina(2026);
    for (const dia of [
      "2026-01-01",
      "2026-02-16", // carnaval
      "2026-02-17",
      "2026-03-24",
      "2026-04-02",
      "2026-04-03", // viernes santo
      "2026-05-01",
      "2026-05-25",
      "2026-06-15", // Güemes (17/6 miércoles -> lunes 15)
      "2026-06-20",
      "2026-07-09",
      "2026-08-17",
      "2026-10-12",
      "2026-11-23", // 20/11 viernes -> lunes 23
      "2026-12-08",
      "2026-12-25"
    ]) {
      expect(f.has(dia), dia).toBe(true);
    }
    expect(f.has("2026-11-20")).toBe(false);
    expect(f.has("2026-06-17")).toBe(false);
  });

  it("los fines de semana y feriados no son días hábiles", () => {
    expect(esDiaHabil("2026-11-14")).toBe(false); // sábado
    expect(esDiaHabil("2026-11-15")).toBe(false); // domingo
    expect(esDiaHabil("2026-11-23")).toBe(false); // feriado trasladado
    expect(esDiaHabil("2026-11-20")).toBe(true); // viernes hábil
  });

  it("cuenta solo los días hábiles transcurridos", () => {
    // viernes 13 -> lunes 16: solo cuenta el lunes
    expect(diasHabilesTranscurridos("2026-11-13", "2026-11-16")).toBe(1);
    // jueves 19 -> martes 24: viernes 20 y martes 24 (lunes 23 es feriado)
    expect(diasHabilesTranscurridos("2026-11-19", "2026-11-24")).toBe(2);
    // mismo día o fechas invertidas
    expect(diasHabilesTranscurridos("2026-11-16", "2026-11-16")).toBe(0);
    expect(diasHabilesTranscurridos("2026-11-20", "2026-11-16")).toBe(0);
  });

  it("toma la fecha en horario argentino (no UTC)", () => {
    // 22:30 del jueves 12/11 en Argentina = 01:30 UTC del viernes 13/11:
    // desde el jueves cuentan el viernes 13 y el lunes 16 (en UTC serían solo 1)
    expect(diasHabilesTranscurridos("2026-11-13T01:30:00Z", "2026-11-16")).toBe(2);
  });
});
