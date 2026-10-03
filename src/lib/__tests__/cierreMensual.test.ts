import { describe, expect, it } from "vitest";
import {
  Aplicacion,
  Caja,
  Comprobante,
  DatosCierre,
  MovTesoreria,
  calcularCierre,
  combinarRentabilidad,
  pendienteHoy,
  ultimosMeses
} from "../cierreMensual";

const CAJA: Caja = { id: "c1", nombre: "Banco", grupo: "bancos", moneda: "ARS", saldo_inicial: 0 };
const EFECTIVO: Caja = { id: "c2", nombre: "Efectivo", grupo: "efectivo", moneda: "ARS", saldo_inicial: 0 };

let seq = 0;
function comp(p: Partial<Comprobante> & Pick<Comprobante, "comprobante_id" | "tipo" | "fecha_devengo" | "monto_total">): Comprobante {
  return {
    origen: "test",
    caso_id: null,
    aseguradora_id: null,
    contraparte_nombre: null,
    categoria: null,
    numero: null,
    moneda: "ARS",
    monto_neto: p.monto_total,
    iva: 0,
    retenciones: 0,
    anulado: false,
    ...p
  };
}

// Una aplicación (cobro/pago) y, si tiene caja, su movimiento de tesorería.
function aplicar(
  datos: DatosCierre,
  comprobanteId: string,
  clase: "cobro" | "pago",
  fecha: string,
  monto: number,
  cajaId: string | null = "c1",
  esAnticipo = false
) {
  const id = `ap${++seq}`;
  const app: Aplicacion = {
    aplicacion_id: id,
    comprobante_id: comprobanteId,
    clase,
    fecha,
    monto,
    caja_id: cajaId,
    es_anticipo: esAnticipo,
    anulado: false
  };
  datos.aplicaciones.push(app);
  if (cajaId) {
    const mov: MovTesoreria = {
      movimiento_id: `m${id}`,
      caja_id: cajaId,
      fecha,
      monto,
      sentido: clase === "cobro" ? "entrada" : "salida",
      origen: clase,
      comprobante_id: comprobanteId,
      es_transferencia_interna: false,
      transferencia_par_id: null
    };
    datos.movimientos.push(mov);
  }
}

function datosVacios(): DatosCierre {
  return { comprobantes: [], aplicaciones: [], movimientos: [], cajas: [{ ...CAJA }, { ...EFECTIVO }] };
}

describe("Test 1 – octubre", () => {
  // Octubre cobró 10.000 (4.000 de septiembre); pendiente de octubre 3.000;
  // pagó 5.000 (1.000 de septiembre); pendiente de octubre 1.500.
  function escenario() {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i-sep", tipo: "ingreso", fecha_devengo: "2026-09-10", monto_total: 4000 }),
      comp({ comprobante_id: "i-oct", tipo: "ingreso", fecha_devengo: "2026-10-05", monto_total: 9000 }),
      comp({ comprobante_id: "e-sep", tipo: "egreso", fecha_devengo: "2026-09-12", monto_total: 1000 }),
      comp({ comprobante_id: "e-oct", tipo: "egreso", fecha_devengo: "2026-10-06", monto_total: 5500 })
    );
    aplicar(d, "i-sep", "cobro", "2026-10-03", 4000);
    aplicar(d, "i-oct", "cobro", "2026-10-10", 6000);
    aplicar(d, "e-sep", "pago", "2026-10-04", 1000);
    aplicar(d, "e-oct", "pago", "2026-10-12", 4000);
    return d;
  }

  it("ingresos 9.000, egresos 5.500, ganancia 3.500, ROI 63,64% y saldo de cajas +5.000", () => {
    const r = calcularCierre("2026-10", escenario());
    expect(r.A1_cobrado_mes).toBe(6000);
    expect(r.A2_pendiente_cierre).toBe(3000);
    expect(r.ingresos).toBe(9000);
    expect(r.B1_pagado_mes).toBe(4000);
    expect(r.B2_pendiente_cierre).toBe(1500);
    expect(r.egresos).toBe(5500);
    expect(r.ganancia).toBe(3500);
    expect(r.roi).toBe(63.64);
    expect(r.C1_cobranzas_anteriores).toBe(4000);
    expect(r.C2_pagos_anteriores).toBe(1000);
    expect(r.variacion_saldo_cajas).toBe(5000);
    expect(r.control_diferencia).toBe(0);
  });

  it("un cobro de un mes anterior no altera el resultado de octubre", () => {
    const d = escenario();
    const sinCobroSep = { ...d, aplicaciones: d.aplicaciones.filter((a) => a.comprobante_id !== "i-sep") };
    const a = calcularCierre("2026-10", d);
    const b = calcularCierre("2026-10", sinCobroSep);
    expect(a.ingresos).toBe(b.ingresos);
    expect(a.egresos).toBe(b.egresos);
  });
});

describe("Test 2 – transferencia interna", () => {
  it("depósito de 2.000 de efectivo al banco: cajas se mueven, total y resultado no", () => {
    const d = datosVacios();
    d.cajas[1].saldo_inicial = 5000; // efectivo
    d.movimientos.push(
      {
        movimiento_id: "t-s", caja_id: "c2", fecha: "2026-10-15", monto: 2000, sentido: "salida",
        origen: "transferencia_interna", comprobante_id: null, es_transferencia_interna: true, transferencia_par_id: "t"
      },
      {
        movimiento_id: "t-e", caja_id: "c1", fecha: "2026-10-15", monto: 2000, sentido: "entrada",
        origen: "transferencia_interna", comprobante_id: null, es_transferencia_interna: true, transferencia_par_id: "t"
      }
    );
    const r = calcularCierre("2026-10", d);
    const banco = r.cajas.find((c) => c.caja_id === "c1")!;
    const efectivo = r.cajas.find((c) => c.caja_id === "c2")!;
    expect(banco.saldo_calculado).toBe(2000);
    expect(efectivo.saldo_calculado).toBe(3000);
    expect(r.saldo_cajas_total).toBe(5000);
    expect(r.variacion_saldo_cajas).toBe(0);
    expect(r.ingresos).toBe(0);
    expect(r.egresos).toBe(0);
    expect(r.C1_cobranzas_anteriores + r.C2_pagos_anteriores + r.caja_A1_bruto + r.caja_B1_bruto).toBe(0);
    expect(r.control_diferencia).toBe(0);
  });
});

describe("casos especiales", () => {
  it("pago parcial: el resto queda pendiente al cierre", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000 }));
    aplicar(d, "i1", "cobro", "2026-10-20", 400);
    const r = calcularCierre("2026-10", d);
    expect(r.A1_cobrado_mes).toBe(400);
    expect(r.A2_pendiente_cierre).toBe(600);
    expect(r.ingresos).toBe(1000);
  });

  it("un pago que cancela varias facturas", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 300 }),
      comp({ comprobante_id: "i2", tipo: "ingreso", fecha_devengo: "2026-10-03", monto_total: 700 })
    );
    aplicar(d, "i1", "cobro", "2026-10-20", 300);
    aplicar(d, "i2", "cobro", "2026-10-20", 700);
    const r = calcularCierre("2026-10", d);
    expect(r.A1_cobrado_mes).toBe(1000);
    expect(r.A2_pendiente_cierre).toBe(0);
    expect(r.por_cobrar_acumulado).toBe(0);
  });

  it("nota de crédito en el mismo mes reduce el ingreso; en un mes posterior ajusta ese mes", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-09-02", monto_total: 1000 }));
    d.aplicaciones.push({
      aplicacion_id: "nc1", comprobante_id: "i1", clase: "nota_credito", fecha: "2026-10-05",
      monto: 200, caja_id: null, es_anticipo: false, anulado: false
    });
    const sep = calcularCierre("2026-09", d);
    const oct = calcularCierre("2026-10", d);
    expect(sep.ingresos).toBe(1000);
    expect(oct.A4_notas_credito_anteriores).toBe(-200);
    expect(oct.ingresos).toBe(-200);
    expect(oct.por_cobrar_acumulado).toBe(800);
  });

  it("comprobante anulado no cuenta", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000, anulado: true }));
    expect(calcularCierre("2026-10", d).ingresos).toBe(0);
  });

  it("cobro anticipado (antes del devengo) cuenta en el resultado del mes del comprobante, no en el del cobro", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-11-02", monto_total: 1000 }));
    aplicar(d, "i1", "cobro", "2026-10-20", 1000);
    const oct = calcularCierre("2026-10", d);
    const nov = calcularCierre("2026-11", d);
    expect(oct.ingresos).toBe(0);
    expect(oct.C3_cobranzas_anticipadas).toBe(1000);
    expect(oct.variacion_saldo_cajas).toBe(1000);
    expect(nov.ingresos).toBe(1000);
    expect(nov.A3_cobrado_antes).toBe(1000);
    expect(nov.A2_pendiente_cierre).toBe(0);
  });

  it("comprobante sin caso asociado entra al resultado", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "g1", tipo: "egreso", caso_id: null, fecha_devengo: "2026-10-02", monto_total: 800 }));
    aplicar(d, "g1", "pago", "2026-10-02", 800);
    const r = calcularCierre("2026-10", d);
    expect(r.egresos).toBe(800);
    expect(r.rentabilidad_por_caso).toHaveLength(0);
  });

  it("cobro y pago en efectivo van a la caja de efectivo", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 500 }),
      comp({ comprobante_id: "e1", tipo: "egreso", fecha_devengo: "2026-10-02", monto_total: 200 })
    );
    aplicar(d, "i1", "cobro", "2026-10-02", 500, "c2");
    aplicar(d, "e1", "pago", "2026-10-02", 200, "c2");
    const r = calcularCierre("2026-10", d);
    expect(r.saldo_efectivo).toBe(300);
    expect(r.saldo_bancos).toBe(0);
  });

  it("neto de IVA: el resultado usa neto y la caja usa bruto", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1210, monto_neto: 1000, iva: 210 })
    );
    aplicar(d, "i1", "cobro", "2026-10-10", 605);
    const r = calcularCierre("2026-10", d);
    expect(r.ingresos).toBe(1000);
    expect(r.A1_cobrado_mes).toBe(500);
    expect(r.A2_pendiente_cierre).toBe(500);
    expect(r.caja_A1_bruto).toBe(605);
    expect(r.por_cobrar_acumulado).toBe(605);
  });

  it("cobro que viene de un anticipo cancela deuda pero no mueve caja", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000 }));
    aplicar(d, "i1", "cobro", "2026-10-10", 1000, null, true);
    d.movimientos.push({
      movimiento_id: "ant1", caja_id: "c1", fecha: "2026-09-20", monto: 1000, sentido: "entrada",
      origen: "anticipo", comprobante_id: null, es_transferencia_interna: false, transferencia_par_id: null
    });
    const r = calcularCierre("2026-10", d);
    expect(r.ingresos).toBe(1000);
    expect(r.A2_pendiente_cierre).toBe(0);
    expect(r.variacion_saldo_cajas).toBe(0);
    expect(r.control_diferencia).toBe(0);
  });
});

describe("validaciones", () => {
  it("ningún comprobante cuenta en el resultado de más de un período", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-08-15", monto_total: 1000 }),
      comp({ comprobante_id: "i2", tipo: "ingreso", fecha_devengo: "2026-09-15", monto_total: 2000 }),
      comp({ comprobante_id: "i3", tipo: "ingreso", fecha_devengo: "2026-10-15", monto_total: 3000 })
    );
    aplicar(d, "i1", "cobro", "2026-09-01", 1000);
    aplicar(d, "i2", "cobro", "2026-10-01", 500);
    const total = ["2026-08", "2026-09", "2026-10", "2026-11"]
      .map((m) => calcularCierre(m, d).ingresos)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(6000);
  });

  it("el detalle suma lo mismo que el resumen", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000 }),
      comp({ comprobante_id: "i2", tipo: "ingreso", fecha_devengo: "2026-10-03", monto_total: 500 })
    );
    aplicar(d, "i1", "cobro", "2026-10-10", 300);
    aplicar(d, "i1", "cobro", "2026-10-12", 200);
    const r = calcularCierre("2026-10", d);
    const cobradoDetalle = r.detalle.ingresos.reduce((a, f) => a + f.aplicado, 0);
    expect(cobradoDetalle).toBe(r.A1_cobrado_mes);
  });

  it("saldo declarado y diferencia de conciliación por caja", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000 }));
    aplicar(d, "i1", "cobro", "2026-10-02", 1000, "c2");
    const r = calcularCierre("2026-10", d, [{ caja_id: "c2", tipo: "arqueo", saldo_declarado: 950 }]);
    const caja = r.cajas.find((c) => c.caja_id === "c2")!;
    expect(caja.diferencia).toBe(-50);
    expect(caja.tipo_declarado).toBe("arqueo");
  });

  it("ROI es N/A (null) si no hay egresos", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000 }));
    expect(calcularCierre("2026-10", d).roi).toBeNull();
  });

  it("ultimosMeses devuelve 12 meses ordenados", () => {
    const m = ultimosMeses("2026-10", 12);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-11");
    expect(m[11]).toBe("2026-10");
  });
});

describe("pendiente hoy vs pendiente al cierre", () => {
  it("un cobro posterior al cierre baja el pendiente de hoy pero no el del cierre", () => {
    const d = datosVacios();
    d.comprobantes.push(comp({ comprobante_id: "i1", tipo: "ingreso", fecha_devengo: "2026-10-02", monto_total: 1000 }));
    aplicar(d, "i1", "cobro", "2026-11-15", 1000);
    expect(calcularCierre("2026-10", d).A2_pendiente_cierre).toBe(1000);
    expect(pendienteHoy("2026-10", d).porCobrar).toBe(0);
  });
});

describe("las líneas de detalle suman exactamente los totales del resumen", () => {
  it("A, B y C salen de las líneas (con IVA, nota de crédito, anticipado y pagos parciales)", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i-sep", tipo: "ingreso", fecha_devengo: "2026-09-10", monto_total: 1210, monto_neto: 1000, iva: 210 }),
      comp({ comprobante_id: "i-oct", tipo: "ingreso", fecha_devengo: "2026-10-05", monto_total: 3025, monto_neto: 2500, iva: 525 }),
      comp({ comprobante_id: "i-nov", tipo: "ingreso", fecha_devengo: "2026-11-05", monto_total: 500 }),
      comp({ comprobante_id: "e-oct", tipo: "egreso", fecha_devengo: "2026-10-06", monto_total: 1210, monto_neto: 1000, iva: 210 }),
      comp({ comprobante_id: "e-sep", tipo: "egreso", fecha_devengo: "2026-09-12", monto_total: 700 })
    );
    aplicar(d, "i-sep", "cobro", "2026-10-03", 605);
    aplicar(d, "i-oct", "cobro", "2026-10-10", 1000);
    aplicar(d, "i-oct", "cobro", "2026-10-20", 333.33);
    aplicar(d, "i-nov", "cobro", "2026-10-25", 500);
    aplicar(d, "e-oct", "pago", "2026-10-12", 400);
    aplicar(d, "e-sep", "pago", "2026-10-04", 700);
    d.aplicaciones.push({
      aplicacion_id: "nc9", comprobante_id: "i-sep", clase: "nota_credito", fecha: "2026-10-15",
      monto: 121, caja_id: null, es_anticipo: false, anulado: false
    });
    const r = calcularCierre("2026-10", d);
    const suma = (bloque: string, linea?: string, campo: "neto" | "total" = "neto") =>
      Math.round(
        r.lineas
          .filter((l) => l.bloque === bloque && (!linea || l.linea === linea))
          .reduce((a, l) => a + l[campo], 0) * 100
      ) / 100;
    expect(suma("A")).toBe(r.ingresos);
    expect(suma("B")).toBe(r.egresos);
    expect(suma("A", "Cobrado en el mes")).toBe(r.A1_cobrado_mes);
    expect(suma("A", "Pendiente al cierre")).toBe(r.A2_pendiente_cierre);
    expect(suma("A", "Nota de crédito de períodos anteriores")).toBe(r.A4_notas_credito_anteriores);
    expect(suma("B", "Pagado en el mes")).toBe(r.B1_pagado_mes);
    expect(suma("B", "Pendiente al cierre")).toBe(r.B2_pendiente_cierre);
    expect(suma("C", "Cobranza de período anterior", "total")).toBe(r.C1_cobranzas_anteriores);
    expect(suma("C", "Pago de período anterior", "total")).toBe(r.C2_pagos_anteriores);
    expect(suma("C", "Cobranza anticipada", "total")).toBe(r.C3_cobranzas_anticipadas);
    // movimientos de caja del mes: las entradas/salidas netas cierran con la variación
    const neto = r.movimientos_caja.reduce((a, m) => a + (m.sentido === "entrada" ? m.monto : -m.monto), 0);
    expect(Math.round(neto * 100) / 100).toBe(r.variacion_saldo_cajas);
  });
});

describe("rentabilidad por caso y por aseguradora", () => {
  it("combina varios meses y agrupa por aseguradora", () => {
    const d = datosVacios();
    d.comprobantes.push(
      comp({ comprobante_id: "i1", tipo: "ingreso", caso_id: "k1", aseguradora_id: "a1", fecha_devengo: "2026-09-10", monto_total: 1000 }),
      comp({ comprobante_id: "e1", tipo: "egreso", caso_id: "k1", aseguradora_id: "a1", fecha_devengo: "2026-10-05", monto_total: 300 }),
      comp({ comprobante_id: "i2", tipo: "ingreso", caso_id: "k2", aseguradora_id: "a2", fecha_devengo: "2026-10-07", monto_total: 500 }),
      comp({ comprobante_id: "e2", tipo: "egreso", caso_id: "k2", aseguradora_id: "a2", fecha_devengo: "2026-10-07", monto_total: 600 })
    );
    const { casos, aseguradoras } = combinarRentabilidad([calcularCierre("2026-09", d), calcularCierre("2026-10", d)]);
    expect(casos.find((c) => c.caso_id === "k1")?.resultado).toBe(700);
    expect(casos.find((c) => c.caso_id === "k2")?.resultado).toBe(-100);
    expect(aseguradoras[0].aseguradora_id).toBe("a1");
    expect(aseguradoras[0].margen).toBe(70);
    expect(aseguradoras[1].resultado).toBe(-100);
    expect(aseguradoras.reduce((a, x) => a + x.resultado, 0)).toBe(600);
  });
});
