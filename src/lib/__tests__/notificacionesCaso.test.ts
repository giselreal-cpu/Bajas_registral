import { describe, expect, it } from "vitest";
import { asuntoYCuerpo, destinatariosDisponibles, normalizarEmails } from "../email/notificacionesCaso";
import type { CasoConRelaciones } from "@/types/database";

const caso = {
  numero_siniestro: "123",
  vehiculo: { dominio: "AB123CD" },
  aseguradora: { nombre: "Allianz" },
  asegurado: { nombre: "PEREZ, JUAN", telefono: "1155550000", email: "juan@x.com" },
  proveedor_reposicion: { id: "p1", nombre: "Reposición SA", emails: "a@rep.com, b@rep.com;  sin-arroba ", telefono: null }
} as unknown as CasoConRelaciones;

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
