import { describe, expect, it } from "vitest";
import {
  construirSeguimiento,
  DatosSeguimiento,
  mailSeguimiento,
  observacionesPublicas,
  ultimaObservacionPublica
} from "../seguimientoProductor";
import { armarEntrada } from "../resumenNovedad";

const base: DatosSeguimiento = {
  numero_siniestro: "123456",
  dominio: "AB123CD",
  aseguradora: "Allianz",
  asegurado: "Juan Pérez",
  tipo_baja: "04D",
  rama: null,
  estado: "en_verificacion",
  deuda_patentes: null,
  deuda_multas: null,
  tieneGestor: false,
  responsable: { nombre: "Ana", email: "ana@oltra.com" },
  eventos: [
    { tipo_evento: "Ingreso de caso", completado: true, fecha_inicio: "2026-11-02", fecha_fin: "2026-11-02" },
    { tipo_evento: "Contacto con el asegurado", completado: true, fecha_inicio: "2026-11-04", fecha_fin: "2026-11-05" }
  ]
};

describe("seguimiento al productor", () => {
  it("marca lo completado con su fecha y lo próximo como pendiente", () => {
    const s = construirSeguimiento(base);
    expect(s.hitos[0]).toEqual({ titulo: "Inicio del trámite", completado: true, fecha: "2026-11-02" });
    expect(s.hitos[1].fecha).toBe("2026-11-05");
    expect(s.esperando).toBe("La autorización de traslado");
    expect(s.luego).toBe("El retiro de la unidad");
  });

  it("presentación cargada y sin completar = presentada, a la espera del registro", () => {
    const eventos = [
      ...base.eventos,
      { tipo_evento: "Presentación de Baja", completado: false, fecha_inicio: "2026-11-06", fecha_fin: null }
    ];
    const datos = { ...base, estado: "gestor_asignado", eventos };
    const s = construirSeguimiento(datos);
    expect(s.frase).toBe("La baja ya fue presentada en el registro automotor y estamos a la espera de que la procese.");
    expect(s.esperando).toBe("Que el registro procese la baja presentada");
    const { text } = mailSeguimiento(datos);
    expect(text).toContain("⏳ Baja presentada en el registro, a la espera de que la procese — desde el 06/11/2026");
    expect(text).not.toMatch(/Presentación de la baja en el registro — pendiente/);
  });

  it("presentación completada se informa como finalizada; sin cargar, como pendiente", () => {
    const completa = [
      ...base.eventos,
      { tipo_evento: "Presentación de Baja", completado: true, fecha_inicio: "2026-11-06", fecha_fin: "2026-11-10" }
    ];
    const a = construirSeguimiento({ ...base, estado: "presentado_en_registro", eventos: completa });
    expect(a.frase).toBe("La presentación de la baja en el registro automotor está finalizada.");
    expect(a.hitos.find((h) => h.titulo === "Presentación de la baja en el registro")?.fecha).toBe("2026-11-10");
    expect(mailSeguimiento(base).text).toContain("• Presentación de la baja en el registro — pendiente");
  });

  it("04 Digital con el IPV completo y sin presentar: falta documentación del asegurado", () => {
    const eventos = [
      ...base.eventos,
      { tipo_evento: "Formulario de Baja", completado: true, fecha_inicio: "2026-11-12", fecha_fin: "2026-11-12" }
    ];
    const datos = { ...base, tipo_baja: "04 Digital", estado: "baja_en_tramite", eventos };
    const s = construirSeguimiento(datos);
    expect(s.frase).toContain("falta documentación por parte del asegurado");
    expect(s.esperando).toBe("La documentación pendiente del asegurado para poder presentar la baja");
    expect(mailSeguimiento(datos).text).toContain(
      "• Presentación de la baja en el registro — a la espera de documentación del asegurado"
    );
    // En 04D la misma situación sigue siendo un simple "pendiente".
    const d04 = mailSeguimiento({ ...datos, tipo_baja: "04D" }).text;
    expect(d04).toContain("• Presentación de la baja en el registro — pendiente");
    expect(d04).not.toContain("documentación del asegurado");
  });

  it("04 Digital con la presentación cargada pasa a esperar al registro", () => {
    const eventos = [
      ...base.eventos,
      { tipo_evento: "Formulario de Baja", completado: true, fecha_inicio: "2026-11-12", fecha_fin: "2026-11-12" },
      { tipo_evento: "Presentación de Baja", completado: false, fecha_inicio: "2026-11-13", fecha_fin: null }
    ];
    const s = construirSeguimiento({ ...base, tipo_baja: "04 Digital", estado: "baja_en_tramite", eventos });
    expect(s.esperando).toBe("Que el registro procese la baja presentada");
  });

  it("muestra el hito del gestor solo si el caso lo tiene", () => {
    expect(construirSeguimiento(base).hitos.some((h) => h.titulo === "Gestor asignado")).toBe(false);
    expect(construirSeguimiento({ ...base, tieneGestor: true }).hitos.some((h) => h.titulo === "Gestor asignado")).toBe(true);
  });

  it("en un 04C pendiente de cierre espera el certificado de compactación", () => {
    const eventos = [
      "Ingreso de caso",
      "Contacto con el asegurado",
      "Autorización de traslado",
      "Traslado",
      "Formulario de Baja",
      "Presentación de Baja",
      "Envío de documentación Cía"
    ].map((tipo_evento) => ({ tipo_evento, completado: true, fecha_inicio: "2026-11-02", fecha_fin: "2026-11-02" }));
    const s = construirSeguimiento({ ...base, tipo_baja: "04C", estado: "cierre_pendiente", eventos });
    expect(s.esperando).toBe("El cierre del caso, a la espera del certificado de compactación");
  });

  it("un caso cerrado o anulado no espera nada", () => {
    expect(construirSeguimiento({ ...base, estado: "cerrado" }).esperando).toBeNull();
    const anulado = construirSeguimiento({ ...base, anulado: true });
    expect(anulado.frase).toBe("El caso fue anulado.");
    expect(anulado.esperando).toBeNull();
  });

  it("la baja digital nombra al IPV", () => {
    const s = construirSeguimiento({ ...base, tipo_baja: "04 Digital" });
    expect(s.hitos.some((h) => h.titulo.includes("IPV"))).toBe(true);
  });

  it("incluye las deudas con montos y no estima tiempos", () => {
    const { text, subject } = mailSeguimiento({ ...base, deuda_patentes: 150000, deuda_multas: 20000 });
    expect(subject).toBe("Seguimiento · Siniestro 123456 · Dominio AB123CD · Allianz");
    expect(text).toContain("SITUACIÓN DE LA UNIDAD");
    expect(text).toMatch(/Deuda de patentes: .*150\.000/);
    expect(text).toMatch(/Multas: .*20\.000/);
    expect(text).not.toMatch(/días|estimad/i);
  });

  it("el mail de contacto es siempre el de Oltra, no el del responsable", () => {
    const { text } = mailSeguimiento(base);
    expect(text).toContain("contactate con Ana de Oltra Gestión Integral (oltra.gestion.integral@gmail.com)");
    expect(text).not.toContain("ana@oltra.com");
    expect(mailSeguimiento({ ...base, responsable: null }).text).toContain("oltra.gestion.integral@gmail.com");
  });

  it("sin deudas ni rama no muestra la sección de situación", () => {
    expect(mailSeguimiento(base).text).not.toContain("SITUACIÓN DE LA UNIDAD");
  });

  it("la observación es opcional y nunca toma las internas", () => {
    const eventos = [
      ...base.eventos,
      { tipo_evento: "Observaciones", completado: true, fecha_inicio: "2026-11-06", fecha_fin: null, es_interna: false, observacion: "Esperando turno" },
      { tipo_evento: "Observaciones", completado: true, fecha_inicio: "2026-11-09", fecha_fin: null, es_interna: true, observacion: "El asegurado es difícil" }
    ];
    const datos = { ...base, eventos };
    expect(ultimaObservacionPublica(eventos)?.texto).toBe("Esperando turno");
    // El mail nunca toma observaciones por su cuenta: solo la novedad aprobada.
    expect(mailSeguimiento(datos).text).not.toContain("Esperando turno");
    expect(mailSeguimiento(datos).text).not.toContain("NOVEDAD");
    const con = mailSeguimiento(datos, { novedad: "  Estamos esperando turno en el registro.  " }).text;
    expect(con).toContain("NOVEDAD\nEstamos esperando turno en el registro.");
    expect(mailSeguimiento(datos, { novedad: "   " }).text).not.toContain("NOVEDAD");
  });

  it("a la IA solo le llegan observaciones públicas, de la más nueva a la más vieja", () => {
    const eventos = [
      { tipo_evento: "Observaciones", completado: true, fecha_inicio: "2026-11-06", fecha_fin: null, es_interna: false, observacion: "Vieja" },
      { tipo_evento: "Observaciones", completado: true, fecha_inicio: "2026-11-09", fecha_fin: null, es_interna: true, observacion: "Interna" },
      { tipo_evento: "Observaciones", completado: true, fecha_inicio: "2026-11-10", fecha_fin: null, es_interna: false, observacion: "Nueva" },
      { tipo_evento: "Observaciones", completado: true, fecha_inicio: "2026-11-11", fecha_fin: null, es_interna: false, observacion: "  " },
      { tipo_evento: "Ingreso de caso", completado: true, fecha_inicio: "2026-11-12", fecha_fin: null, es_interna: false, observacion: "No es observación" }
    ];
    const obs = observacionesPublicas(eventos);
    expect(obs.map((o) => o.texto)).toEqual(["Nueva", "Vieja"]);
    expect(armarEntrada(obs, "Estado X")).toBe(
      "Estado actual del caso (ya informado en el mail): Estado X\n\n<observaciones>\n[10/11/2026] Nueva\n\n[06/11/2026] Vieja\n</observaciones>"
    );
  });

  it("Solo Informes tiene sus propios pasos", () => {
    const s = construirSeguimiento({ ...base, tipo_baja: "Solo Informes" });
    expect(s.hitos.map((h) => h.titulo)).toContain("Informes enviados a la compañía");
    expect(s.hitos.some((h) => h.titulo === "Retiro de la unidad")).toBe(false);
  });
});
