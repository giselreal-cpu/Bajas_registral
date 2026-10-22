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
