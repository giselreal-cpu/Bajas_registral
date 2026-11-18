import { describe, expect, it } from "vitest";
import { mensajeDocumentacionLista, mensajeLlegaVehiculo } from "../mensajesDesarmadero";

const datos = {
  numeroSiniestro: "9988",
  dominio: "OIM398",
  marca: "VOLKSWAGEN",
  modelo: "GOL TREND 1.6",
  enlace: "https://ogi.com.ar/d/abc"
};

describe("mensajes al desarmadero", () => {
  it("el primer aviso no cambia", () => {
    expect(mensajeLlegaVehiculo(datos)).toBe(
      "Te llega un vehículo por el caso 9988.\nDominio: OIM398\nPodés seguir el estado del trámite acá: https://ogi.com.ar/d/abc"
    );
  });

  it("el aviso de documentación lista ofrece cargar en RUDAC o revisar y completar la carga", () => {
    const m = mensajeDocumentacionLista(datos);
    expect(m).toContain("Ya tenés la documentación por el caso VOLKSWAGEN GOL TREND 1.6.");
    expect(m).toContain("cargarla en el sistema del RUDAC, o bien revisar la documentación y completar la carga");
    expect(m).toContain("Dominio: OIM398");
    expect(m.endsWith("https://ogi.com.ar/d/abc")).toBe(true);
  });

  it("sin marca ni modelo usa el número de siniestro", () => {
    expect(mensajeDocumentacionLista({ ...datos, marca: null, modelo: " " })).toContain("por el caso 9988.");
  });
});
