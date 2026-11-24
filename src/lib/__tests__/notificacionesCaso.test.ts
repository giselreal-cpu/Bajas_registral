import { describe, expect, it } from "vitest";
import {
  TEXTO_INFORME_ADJUNTO,
  asuntoYCuerpo,
  destinatariosDisponibles,
  llevaInformeDominio,
  normalizarEmails
} from "../email/notificacionesCaso";
import { nombreAdjunto } from "../email/adjuntosInformeDominio";
import { esInformeDominio } from "../documentosVisiblesExternos";
import type { CasoConRelaciones } from "@/types/database";

const caso = {
  numero_siniestro: "123",
  vehiculo: { dominio: "AB123CD" },
  aseguradora: { nombre: "Allianz" },
  asegurado: { nombre: "PEREZ, JUAN", telefono: "1155550000", email: "juan@x.com" },
  proveedor_reposicion: { id: "p1", nombre: "Reposición SA", emails: "a@rep.com, b@rep.com;  sin-arroba ", telefono: null }
} as unknown as CasoConRelaciones;

describe("informe de dominio adjunto para la compañía", () => {
  it("lo llevan el aviso de contacto y el de petición de informes, solo para tramitador y productor", () => {
    for (const tipo of ["contacto_asegurado", "peticion_informes"] as const) {
      expect(llevaInformeDominio(tipo, "tramitador")).toBe(true);
      expect(llevaInformeDominio(tipo, "productor")).toBe(true);
      expect(llevaInformeDominio(tipo, "asegurado")).toBe(false);
      expect(llevaInformeDominio(tipo, "reposicion")).toBe(false);
    }
    expect(llevaInformeDominio("traslado", "tramitador")).toBe(false);
    expect(llevaInformeDominio("cierre_caso", "productor")).toBe(false);
  });
  it("el texto avisa del adjunto solo cuando se adjunta", () => {
    const con = asuntoYCuerpo("peticion_informes", caso, "tramitador", { conInformeAdjunto: true });
    expect(con.subject).toContain("Informes de dominio");
    expect(con.text).toContain("se completó el pedido de informes");
    expect(con.text).toContain(TEXTO_INFORME_ADJUNTO);
    expect(asuntoYCuerpo("peticion_informes", caso, "tramitador").text).not.toContain("Adjuntamos");
    expect(asuntoYCuerpo("contacto_asegurado", caso, "tramitador", { conInformeAdjunto: true }).text).toContain(
      TEXTO_INFORME_ADJUNTO
    );
  });
  it("reconoce el informe de dominio por el nombre y arma el nombre del adjunto", () => {
    expect(esInformeDominio("Informe de dominio")).toBe(true);
    expect(esInformeDominio("INFORME DE DOMINIO histórico")).toBe(true);
    expect(esInformeDominio("Informe de multas")).toBe(false);
    expect(nombreAdjunto("Informe de dominio", "casos/1/x/123-informe.pdf")).toBe("Informe de dominio.pdf");
    expect(nombreAdjunto("Informe de dominio.pdf", "casos/1/x/123.pdf")).toBe("Informe de dominio.pdf");
    expect(nombreAdjunto("Informe de dominio", "casos/1/x/sin-ext", "application/pdf")).toBe("Informe de dominio.pdf");
  });
});

describe("proveedor de reposición en los avisos", () => {
  it("normaliza los mails del proveedor (varios contactos, separados por coma)", () => {
    expect(normalizarEmails("a@x.com, b@x.com; c@x.com  basura")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(normalizarEmails(null)).toEqual([]);
    expect(destinatariosDisponibles(caso).reposicion).toBe("a@rep.com, b@rep.com");
  });
  it("sin proveedor no hay destinatario de reposición", () => {
    expect(destinatariosDisponibles({ ...caso, proveedor_reposicion: null } as CasoConRelaciones).reposicion).toBeNull();
  });
  it("el proveedor recibe los datos de contacto del asegurado; los demás no", () => {
    const paraProveedor = asuntoYCuerpo("traslado", caso, "reposicion").text;
    expect(paraProveedor).toContain("1155550000");
    expect(paraProveedor).toContain("juan@x.com");
    expect(asuntoYCuerpo("traslado", caso, "tramitador").text).not.toContain("1155550000");
  });
  it("hay aviso de cierre del caso", () => {
    const { subject, text } = asuntoYCuerpo("cierre_caso", caso);
    expect(subject).toContain("Caso cerrado");
    expect(text).toContain("se cerró el caso");
    expect(text).toContain("AB123CD");
  });
});
