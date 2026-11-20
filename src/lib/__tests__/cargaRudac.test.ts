import { describe, expect, it } from "vitest";
import { EVENTO_CARGA_RUDAC, eventoAplicaATipoBaja, motivoBloqueo, tipoEventoDe } from "../eventosBitacora";
import { construirSeguimiento, DatosSeguimiento, mailSeguimiento } from "../seguimientoProductor";

const ev = (tipo_evento: string, completado: boolean, id = tipo_evento) => ({ id, tipo_evento, completado });

describe("evento Carga en RUDAC (desarmadero)", () => {
  it("es del catálogo y solo se ofrece en la baja digital", () => {
    expect(tipoEventoDe(EVENTO_CARGA_RUDAC)?.requiere).toBe("Formulario de Baja");
    expect(eventoAplicaATipoBaja(EVENTO_CARGA_RUDAC, "04 Digital")).toBe(true);
    expect(eventoAplicaATipoBaja(EVENTO_CARGA_RUDAC, "04D")).toBe(false);
    expect(eventoAplicaATipoBaja(EVENTO_CARGA_RUDAC, "04C")).toBe(false);
    expect(eventoAplicaATipoBaja("Traslado", "04D")).toBe(true);
  });

  it("se completa recién con el formulario (IPV) completado", () => {
    expect(motivoBloqueo(EVENTO_CARGA_RUDAC, [ev("Formulario de Baja", false)])).toContain("Formulario de Baja");
    expect(motivoBloqueo(EVENTO_CARGA_RUDAC, [ev("Formulario de Baja", true)])).toBeNull();
  });

  it("no se puede cerrar el caso con la carga en RUDAC pendiente, pero sí si nunca se cargó el evento", () => {
    const todo = [
      "Petición de Informes",
      "Autorización de traslado",
      "Traslado",
      "Formulario de Baja",
      "Presentación de Baja",
      "Envío de documentación Cía"
    ].map((t) => ev(t, true));
    expect(motivoBloqueo("Cierre de Caso", [...todo, ev(EVENTO_CARGA_RUDAC, false)])).toContain(EVENTO_CARGA_RUDAC);
    expect(motivoBloqueo("Cierre de Caso", [...todo, ev(EVENTO_CARGA_RUDAC, true)])).toBeNull();
    // casos en curso que nunca lo cargaron no quedan trabados
    expect(motivoBloqueo("Cierre de Caso", todo)).toBeNull();
  });
});

describe("seguimiento al productor con la carga en RUDAC", () => {
  const base: DatosSeguimiento = {
    numero_siniestro: "1",
    dominio: "AB123CD",
    aseguradora: "Allianz",
    asegurado: "Juan",
    tipo_baja: "04 Digital",
    rama: null,
    estado: "baja_en_tramite",
    deuda_patentes: null,
    deuda_multas: null,
    tieneGestor: false,
    responsable: null,
    eventos: [
      { tipo_evento: "Ingreso de caso", completado: true, fecha_inicio: "2026-11-02", fecha_fin: "2026-11-02" },
      { tipo_evento: "Formulario de Baja", completado: true, fecha_inicio: "2026-11-12", fecha_fin: "2026-11-12" }
    ]
  };

  it("con el evento pendiente: espera que el desarmadero cargue en RUDAC (no documentación del asegurado)", () => {
    const datos = {
      ...base,
      eventos: [
        ...base.eventos,
        { tipo_evento: EVENTO_CARGA_RUDAC, completado: false, fecha_inicio: "2026-11-13", fecha_fin: null }
      ]
    };
    const s = construirSeguimiento(datos);
    expect(s.frase).toBe("La documentación ya está lista y el desarmadero está cargándola en el sistema RUDAC.");
    expect(s.esperando).toBe("Que el desarmadero cargue la documentación en el sistema RUDAC");
    const { text } = mailSeguimiento(datos);
    expect(text).toContain("⏳ Documentación entregada al desarmadero, a la espera de que la cargue en RUDAC — desde el 13/11/2026");
    expect(text).not.toContain("documentación del asegurado");
  });

  it("completado: figura como hecho con su fecha; sin el evento, el paso no aparece", () => {
    const completo = {
      ...base,
      eventos: [
        ...base.eventos,
        { tipo_evento: EVENTO_CARGA_RUDAC, completado: true, fecha_inicio: "2026-11-13", fecha_fin: "2026-11-16" }
      ]
    };
    expect(mailSeguimiento(completo).text).toContain("✔ Documentación cargada en RUDAC por el desarmadero — 16/11/2026");
    expect(mailSeguimiento(base).text).not.toContain("RUDAC");
    // en otros tipos de baja el paso no existe
    expect(mailSeguimiento({ ...completo, tipo_baja: "04D" }).text).not.toContain("RUDAC");
  });
});
