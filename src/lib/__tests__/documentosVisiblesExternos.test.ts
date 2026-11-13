import { describe, expect, it } from "vitest";
import { clasificarDocumentosVisibles } from "../documentosVisiblesExternos";

const doc = (nombre: string, categoria = "documento_compania") => ({ nombre, categoria });

describe("clasificarDocumentosVisibles", () => {
  it("muestra solo título, cédulas, informe de dominio, foto del titular y fotos", () => {
    const docs = [
      doc("Título"),
      doc("Cédula verde"),
      doc("Informe de dominio"),
      doc("Foto titular", "imagen_dominio"),
      doc("Fotos", "imagen_dominio"),
      doc("Multas"),
      doc("Patentes"),
      doc("Autorización"),
      doc("Certificado de dominio", "otros_gestor"),
      doc("Multas desarmadero", "multa_desarmadero"),
      doc("Anexo 04", "anexo04_rudac")
    ];
    const v = clasificarDocumentosVisibles(docs);
    expect(v.titulo.map((d) => d.nombre)).toEqual(["Título"]);
    expect(v.cedulas.map((d) => d.nombre)).toEqual(["Cédula verde"]);
    expect(v.informeDominio.map((d) => d.nombre)).toEqual(["Informe de dominio"]);
    expect(v.fotoTitular.map((d) => d.nombre)).toEqual(["Foto titular"]);
    // la foto del titular no se repite en Fotos
    expect(v.fotos.map((d) => d.nombre)).toEqual(["Fotos"]);
  });
});

describe("clasificarDocumentosVisibles: DNI, estatuto, poder y extravío", () => {
  it("reconoce los documentos extra que también puede ver el desarmadero", () => {
    const docs = [
      doc("DNI frente"),
      doc("Cédula - DNI"),
      doc("Estatuto"),
      doc("Poder"),
      doc("Denuncia por extravío"),
      doc("Foto titulat", "imagen_dominio"),
      doc("Autorización"),
      doc("Denuncia siniestro"),
      doc("Multas")
    ];
    const v = clasificarDocumentosVisibles(docs);
    expect(v.dni.map((d) => d.nombre)).toEqual(["DNI frente", "Cédula - DNI"]);
    expect(v.cedulas.map((d) => d.nombre)).toEqual(["Cédula - DNI"]);
    expect(v.estatuto).toHaveLength(1);
    expect(v.poder).toHaveLength(1);
    expect(v.extravio.map((d) => d.nombre)).toEqual(["Denuncia por extravío"]);
    expect(v.fotoTitular.map((d) => d.nombre)).toEqual(["Foto titulat"]);
    // lo que no está en la lista no se comparte
    const compartidos = new Set(Object.values(v).flat().map((d) => d.nombre));
    expect(compartidos.has("Autorización")).toBe(false);
    expect(compartidos.has("Denuncia siniestro")).toBe(false);
    expect(compartidos.has("Multas")).toBe(false);
  });
});
