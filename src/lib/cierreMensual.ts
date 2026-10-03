// Cálculo del Cierre Mensual. Separa dos criterios para no contar nada dos
// veces:
//  - DEVENGADO (resultado): un comprobante pertenece al mes de su
//    fecha_devengo, sin importar cuándo se cobre o pague. Se calcula NETO
//    de IVA.
//  - CAJA (liquidez): un movimiento pertenece al mes en que la plata
//    entra o sale de una caja. Se calcula en bruto (con IVA).
// Las transferencias internas entre cajas no son cobros ni pagos: solo
// aparecen en la liquidez por caja y se anulan en el total.
//
// Las funciones de este archivo son puras (reciben las filas de las
// vistas v_comprobantes / v_aplicaciones / v_movimientos_tesoreria /
// v_cajas_liquidez); el acceso a la base está en cierreMensualDatos.ts.

export interface Comprobante {
  comprobante_id: string;
  origen: string;
  tipo: "ingreso" | "egreso";
  caso_id: string | null;
  aseguradora_id: string | null;
  contraparte_nombre: string | null;
  categoria: string | null;
  numero: string | null;
  fecha_devengo: string;
  moneda: string;
  monto_total: number;
  monto_neto: number;
  iva: number;
  retenciones: number;
  anulado: boolean;
}

export interface Aplicacion {
  aplicacion_id: string;
  comprobante_id: string;
  clase: "cobro" | "pago" | "nota_credito";
  fecha: string;
  monto: number;
  caja_id: string | null;
  es_anticipo: boolean;
  anulado: boolean;
}

export interface MovTesoreria {
  movimiento_id: string;
  caja_id: string;
  fecha: string;
  monto: number;
  sentido: "entrada" | "salida";
  origen: string;
  comprobante_id: string | null;
  es_transferencia_interna: boolean;
  transferencia_par_id: string | null;
}

export interface Caja {
  id: string;
  nombre: string;
  grupo: "bancos" | "efectivo";
  tipo?: string;
  moneda: string;
  saldo_inicial: number;
}

export interface SaldoDeclarado {
  caja_id: string;
  tipo: "extracto" | "arqueo";
  saldo_declarado: number;
}

export interface DatosCierre {
  comprobantes: Comprobante[];
  aplicaciones: Aplicacion[];
  movimientos: MovTesoreria[];
  cajas: Caja[];
}

export interface FilaDetalle {
  comprobante_id: string;
  caso_id: string | null;
  aseguradora_id: string | null;
  contraparte: string | null;
  categoria: string | null;
  numero: string | null;
  fecha_devengo: string;
  fecha_aplicacion: string | null;
  caja_id: string | null;
  neto: number;
  iva: number;
  total: number;
  aplicado: number;
  pendiente: number;
}

// Una línea de las que componen los bloques del cierre: cada una aporta una
// parte del total (cobrado en el mes, pendiente al cierre, etc.), así el
// export puede sumar el detalle con SUMIFS y llegar al mismo número que el
// resumen. En los bloques A y B `neto` es lo que entra al resultado y
// `total` el bruto (con IVA); en C es solo caja (bruto).
export interface LineaCierre {
  bloque: "A" | "B" | "C";
  linea: string;
  comprobante_id: string;
  caso_id: string | null;
  aseguradora_id: string | null;
  contraparte: string | null;
  categoria: string | null;
  numero: string | null;
  fecha_devengo: string;
  fecha_aplicacion: string | null;
  caja_id: string | null;
  neto: number;
  iva: number;
  total: number;
  aplicado: number;
  pendiente: number;
  total_comprobante: number;
}

export interface MovimientoCajaFila {
  movimiento_id: string;
  caja_id: string;
  caja: string;
  grupo: "bancos" | "efectivo";
  moneda: string;
  fecha: string;
  sentido: "entrada" | "salida";
  monto: number;
  origen: string;
  comprobante_id: string | null;
  es_transferencia_interna: boolean;
}

export interface RentabilidadCaso {
  caso_id: string;
  aseguradora_id: string | null;
  ingresos: number;
  egresos: number;
  resultado: number;
}

export interface RentabilidadAseguradora {
  aseguradora_id: string | null;
  casos: number;
  ingresos: number;
  egresos: number;
  resultado: number;
  margen: number | null;
}

export interface CajaCierre {
  caja_id: string;
  nombre: string;
  grupo: "bancos" | "efectivo";
  moneda: string;
  saldo_inicial_periodo: number;
  entradas: number;
  salidas: number;
  entradas_transferencia: number;
  salidas_transferencia: number;
  saldo_calculado: number;
  saldo_declarado: number | null;
  tipo_declarado: "extracto" | "arqueo" | null;
  diferencia: number | null;
}

export interface ResultadoCierre {
  mes: string;
  // Bloque A – ingresos (neto de IVA)
  A1_cobrado_mes: number;
  A2_pendiente_cierre: number;
  A3_cobrado_antes: number;
  A4_notas_credito_anteriores: number;
  ingresos: number;
  // Bloque B – egresos (neto de IVA)
  B1_pagado_mes: number;
  B2_pendiente_cierre: number;
  B3_pagado_antes: number;
  egresos: number;
  // Bloque C – caja de otros períodos (bruto, informativo)
  C1_cobranzas_anteriores: number;
  C2_pagos_anteriores: number;
  C3_cobranzas_anticipadas: number;
  C4_pagos_anticipados: number;
  // Caja bruta del mes de comprobantes del mes (para el control)
  caja_A1_bruto: number;
  caja_B1_bruto: number;
  anticipos_recibidos: number;
  // Indicadores
  ganancia: number;
  roi: number | null;
  margen: number | null;
  por_cobrar_acumulado: number;
  por_pagar_acumulado: number;
  // Pendiente BRUTO al cierre de los comprobantes del mes (para compararlo con "hoy")
  pendiente_cierre_cobrar_bruto: number;
  pendiente_cierre_pagar_bruto: number;
  // Liquidez
  cajas: CajaCierre[];
  saldo_inicial_total: number;
  saldo_cajas_total: number;
  saldo_bancos: number;
  saldo_efectivo: number;
  variacion_saldo_cajas: number;
  control_diferencia: number;
  capital_de_trabajo: number;
  // Detalle
  detalle: {
    ingresos: FilaDetalle[];
    egresos: FilaDetalle[];
    anteriores: FilaDetalle[];
  };
  rentabilidad_por_caso: RentabilidadCaso[];
  lineas: LineaCierre[];
  movimientos_caja: MovimientoCajaFila[];
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function rangoMes(mes: string): { desde: string; hasta: string; proximo: string } {
  const [a, m] = mes.split("-").map(Number);
  const desde = `${mes}-01`;
  const sig = new Date(Date.UTC(a, m, 1));
  const proximo = sig.toISOString().slice(0, 10);
  const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { desde, hasta: fin, proximo };
}

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

export function calcularCierre(mes: string, datos: DatosCierre, declarados: SaldoDeclarado[] = []): ResultadoCierre {
  const { desde, hasta } = rangoMes(mes);

  const comprobantes = datos.comprobantes.filter((c) => !c.anulado);
  const porId = new Map(comprobantes.map((c) => [c.comprobante_id, c]));
  const aplicaciones = datos.aplicaciones.filter((a) => !a.anulado && porId.has(a.comprobante_id));

  const aplicacionesDe = new Map<string, Aplicacion[]>();
  for (const a of aplicaciones) {
    const lista = aplicacionesDe.get(a.comprobante_id) ?? [];
    lista.push(a);
    aplicacionesDe.set(a.comprobante_id, lista);
  }

  // Proporción neta del comprobante: lo cobrado/pagado/acreditado es bruto
  // (con IVA), el resultado se mide neto.
  const ratio = (c: Comprobante) => (c.monto_total > 0 ? c.monto_neto / c.monto_total : 1);

  const suma = (lista: Aplicacion[], f: (a: Aplicacion) => boolean) =>
    lista.filter(f).reduce((acc, a) => acc + a.monto, 0);

  let A1 = 0, A2 = 0, A3 = 0, A4 = 0;
  let B1 = 0, B2 = 0, B3 = 0;
  let porCobrar = 0, porPagar = 0;
  let pendMesCobrar = 0, pendMesPagar = 0;
  const detIngresos: FilaDetalle[] = [];
  const detEgresos: FilaDetalle[] = [];
  const detAnteriores: FilaDetalle[] = [];
  const lineas: LineaCierre[] = [];
  const porCaso = new Map<string, { ingresos: number; egresos: number; aseguradora_id: string | null }>();

  const fila = (c: Comprobante, a: Aplicacion | null, aplicado: number, pendiente: number): FilaDetalle => ({
    comprobante_id: c.comprobante_id,
    caso_id: c.caso_id,
    aseguradora_id: c.aseguradora_id,
    contraparte: c.contraparte_nombre,
    categoria: c.categoria,
    numero: c.numero,
    fecha_devengo: c.fecha_devengo,
    fecha_aplicacion: a?.fecha ?? null,
    caja_id: a?.caja_id ?? null,
    neto: c.monto_neto,
    iva: c.iva,
    total: c.monto_total,
    aplicado,
    pendiente
  });

  const sumarCaso = (c: Comprobante, neto: number) => {
    if (!c.caso_id) return;
    const x = porCaso.get(c.caso_id) ?? { ingresos: 0, egresos: 0, aseguradora_id: c.aseguradora_id };
    if (c.tipo === "ingreso") x.ingresos += neto;
    else x.egresos += neto;
    porCaso.set(c.caso_id, x);
  };

  for (const c of comprobantes) {
    const apps = aplicacionesDe.get(c.comprobante_id) ?? [];
    const es = c.tipo === "ingreso";
    const clasePago = es ? "cobro" : "pago";
    const k = ratio(c);
    const enMes = c.fecha_devengo >= desde && c.fecha_devengo <= hasta;

    // Saldo pendiente al cierre del mes (as-of fin de mes).
    const aplicadoHastaFin = suma(apps, (a) => (a.clase === clasePago || a.clase === "nota_credito") && a.fecha <= hasta);
    const pendienteBruto = Math.max(c.monto_total - aplicadoHastaFin, 0);
    if (c.fecha_devengo <= hasta) {
      if (es) porCobrar += pendienteBruto;
      else porPagar += pendienteBruto;
    }

    const linea = (
      bloque: "A" | "B" | "C",
      nombre: string,
      a: Aplicacion | null,
      bruto: number,
      neto: number,
      tipoMonto: "aplicado" | "pendiente"
    ) => {
      lineas.push({
        bloque,
        linea: nombre,
        comprobante_id: c.comprobante_id,
        caso_id: c.caso_id,
        aseguradora_id: c.aseguradora_id,
        contraparte: c.contraparte_nombre,
        categoria: c.categoria,
        numero: c.numero,
        fecha_devengo: c.fecha_devengo,
        fecha_aplicacion: a?.fecha ?? null,
        caja_id: a?.caja_id ?? null,
        neto,
        iva: r2(bruto - neto),
        total: bruto,
        aplicado: tipoMonto === "aplicado" ? bruto : 0,
        pendiente: tipoMonto === "pendiente" ? bruto : 0,
        total_comprobante: c.monto_total
      });
    };
    const delMesApps = apps.filter((x) => x.clase === clasePago && x.fecha >= desde && x.fecha <= hasta);

    if (enMes) {
      if (es) pendMesCobrar += pendienteBruto;
      else pendMesPagar += pendienteBruto;

      for (const a of delMesApps) {
        const neto = r2(a.monto * k);
        if (es) A1 += neto;
        else B1 += neto;
        linea(es ? "A" : "B", es ? "Cobrado en el mes" : "Pagado en el mes", a, a.monto, neto, "aplicado");
      }
      for (const a of apps.filter((x) => x.clase === clasePago && x.fecha < desde)) {
        const neto = r2(a.monto * k);
        if (es) A3 += neto;
        else B3 += neto;
        linea(es ? "A" : "B", es ? "Cobrado antes del mes" : "Pagado antes del mes", a, a.monto, neto, "aplicado");
      }
      if (pendienteBruto > 0) {
        const neto = r2(pendienteBruto * k);
        if (es) A2 += neto;
        else B2 += neto;
        linea(es ? "A" : "B", "Pendiente al cierre", null, pendienteBruto, neto, "pendiente");
      }

      sumarCaso(c, c.monto_neto - (es ? r2(suma(apps, (a) => a.clase === "nota_credito" && a.fecha <= hasta) * k) : 0));
      const destino = es ? detIngresos : detEgresos;
      if (delMesApps.length === 0) destino.push(fila(c, null, 0, pendienteBruto));
      for (const a of delMesApps) destino.push(fila(c, a, a.monto, pendienteBruto));
    } else {
      // Cobranzas/pagos de este mes de comprobantes de otros períodos: solo
      // caja (con caja asignada; lo aplicado desde un anticipo no mueve caja).
      const anticipado = c.fecha_devengo > hasta;
      for (const a of delMesApps) {
        detAnteriores.push(fila(c, a, a.monto, pendienteBruto));
        if (a.caja_id) {
          const nombre = anticipado
            ? es ? "Cobranza anticipada" : "Pago anticipado"
            : es ? "Cobranza de período anterior" : "Pago de período anterior";
          linea("C", nombre, a, a.monto, r2(a.monto * k), "aplicado");
        }
      }
      // Nota de crédito de este mes sobre un comprobante anterior: ajusta el
      // resultado del mes en que se emite (no reescribe el mes original).
      if (es && !anticipado) {
        for (const nc of apps.filter((x) => x.clase === "nota_credito" && x.fecha >= desde && x.fecha <= hasta)) {
          const neto = -r2(nc.monto * k);
          A4 += neto;
          linea("A", "Nota de crédito de períodos anteriores", nc, -nc.monto, neto, "aplicado");
        }
      }
    }
  }

  const ingresos = r2(A1 + A2 + A3 + A4);
  const egresos = r2(B1 + B2 + B3);
  const ganancia = r2(ingresos - egresos);
  const roi = egresos === 0 ? null : r2((ganancia / egresos) * 100);
  const margen = ingresos === 0 ? null : r2((ganancia / ingresos) * 100);

  // ---- Caja ----
  const cajasPorId = new Map(datos.cajas.map((c) => [c.id, c]));
  const movs = datos.movimientos.filter((m) => cajasPorId.has(m.caja_id));

  let cajaA1 = 0, cajaB1 = 0, C1 = 0, C2 = 0, C3 = 0, C4 = 0, anticipos = 0;
  for (const m of movs) {
    if (m.fecha < desde || m.fecha > hasta || m.es_transferencia_interna) continue;
    if (m.origen === "anticipo") {
      anticipos += m.monto;
      continue;
    }
    const c = m.comprobante_id ? porId.get(m.comprobante_id) : undefined;
    if (!c) continue;
    const entra = m.sentido === "entrada";
    if (c.fecha_devengo >= desde && c.fecha_devengo <= hasta) {
      if (entra) cajaA1 += m.monto;
      else cajaB1 += m.monto;
    } else if (c.fecha_devengo < desde) {
      if (entra) C1 += m.monto;
      else C2 += m.monto;
    } else if (entra) C3 += m.monto;
    else C4 += m.monto;
  }

  const declaradoPorCaja = new Map(declarados.map((d) => [d.caja_id, d]));
  const cajas: CajaCierre[] = datos.cajas.map((caja) => {
    const propios = movs.filter((m) => m.caja_id === caja.id);
    const antes = propios.filter((m) => m.fecha < desde);
    const delMes = propios.filter((m) => m.fecha >= desde && m.fecha <= hasta);
    const saldoInicialPeriodo =
      caja.saldo_inicial +
      antes.filter((m) => m.sentido === "entrada").reduce((a, m) => a + m.monto, 0) -
      antes.filter((m) => m.sentido === "salida").reduce((a, m) => a + m.monto, 0);
    const entradas = delMes.filter((m) => m.sentido === "entrada").reduce((a, m) => a + m.monto, 0);
    const salidas = delMes.filter((m) => m.sentido === "salida").reduce((a, m) => a + m.monto, 0);
    const entTrf = delMes
      .filter((m) => m.sentido === "entrada" && m.es_transferencia_interna)
      .reduce((a, m) => a + m.monto, 0);
    const salTrf = delMes
      .filter((m) => m.sentido === "salida" && m.es_transferencia_interna)
      .reduce((a, m) => a + m.monto, 0);
    const calculado = r2(saldoInicialPeriodo + entradas - salidas);
    const dec = declaradoPorCaja.get(caja.id);
    return {
      caja_id: caja.id,
      nombre: caja.nombre,
      grupo: caja.grupo,
      moneda: caja.moneda,
      saldo_inicial_periodo: r2(saldoInicialPeriodo),
      entradas: r2(entradas),
      salidas: r2(salidas),
      entradas_transferencia: r2(entTrf),
      salidas_transferencia: r2(salTrf),
      saldo_calculado: calculado,
      saldo_declarado: dec ? dec.saldo_declarado : null,
      tipo_declarado: dec ? dec.tipo : null,
      diferencia: dec ? r2(dec.saldo_declarado - calculado) : null
    };
  });

  // Los totales mezclan solo cajas en ARS; las de otra moneda se listan
  // aparte (sin convertir).
  const enPesos = cajas.filter((c) => c.moneda === "ARS");
  const saldoInicialTotal = r2(enPesos.reduce((a, c) => a + c.saldo_inicial_periodo, 0));
  const saldoCajasTotal = r2(enPesos.reduce((a, c) => a + c.saldo_calculado, 0));
  const saldoBancos = r2(enPesos.filter((c) => c.grupo === "bancos").reduce((a, c) => a + c.saldo_calculado, 0));
  const saldoEfectivo = r2(enPesos.filter((c) => c.grupo === "efectivo").reduce((a, c) => a + c.saldo_calculado, 0));
  const variacion = r2(saldoCajasTotal - saldoInicialTotal);

  // Control: saldo inicial + entradas - salidas (excluidas transferencias,
  // que se anulan entre sí) = saldo final calculado. Solo cajas en ARS.
  const idsPesos = new Set(enPesos.map((c) => c.caja_id));
  const flujoControl = r2(
    movs
      .filter((m) => idsPesos.has(m.caja_id) && m.fecha >= desde && m.fecha <= hasta && !m.es_transferencia_interna)
      .reduce((a, m) => a + (m.sentido === "entrada" ? m.monto : -m.monto), 0)
  );
  const controlDiferencia = r2(saldoInicialTotal + flujoControl - saldoCajasTotal);

  const rentabilidad = Array.from(porCaso.entries())
    .map(([caso_id, v]) => ({
      caso_id,
      aseguradora_id: v.aseguradora_id,
      ingresos: r2(v.ingresos),
      egresos: r2(v.egresos),
      resultado: r2(v.ingresos - v.egresos)
    }))
    .sort((a, b) => b.resultado - a.resultado);

  return {
    mes,
    A1_cobrado_mes: r2(A1),
    A2_pendiente_cierre: r2(A2),
    A3_cobrado_antes: r2(A3),
    A4_notas_credito_anteriores: r2(A4),
    ingresos,
    B1_pagado_mes: r2(B1),
    B2_pendiente_cierre: r2(B2),
    B3_pagado_antes: r2(B3),
    egresos,
    C1_cobranzas_anteriores: r2(C1),
    C2_pagos_anteriores: r2(C2),
    C3_cobranzas_anticipadas: r2(C3),
    C4_pagos_anticipados: r2(C4),
    caja_A1_bruto: r2(cajaA1),
    caja_B1_bruto: r2(cajaB1),
    anticipos_recibidos: r2(anticipos),
    ganancia,
    roi,
    margen,
    por_cobrar_acumulado: r2(porCobrar),
    por_pagar_acumulado: r2(porPagar),
    pendiente_cierre_cobrar_bruto: r2(pendMesCobrar),
    pendiente_cierre_pagar_bruto: r2(pendMesPagar),
    cajas,
    saldo_inicial_total: saldoInicialTotal,
    saldo_cajas_total: saldoCajasTotal,
    saldo_bancos: saldoBancos,
    saldo_efectivo: saldoEfectivo,
    variacion_saldo_cajas: variacion,
    control_diferencia: controlDiferencia,
    capital_de_trabajo: r2(saldoCajasTotal + porCobrar - porPagar),
    detalle: { ingresos: detIngresos, egresos: detEgresos, anteriores: detAnteriores },
    rentabilidad_por_caso: rentabilidad,
    lineas,
    movimientos_caja: movs
      .filter((m) => m.fecha >= desde && m.fecha <= hasta)
      .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0))
      .map((m) => {
        const caja = cajasPorId.get(m.caja_id)!;
        return {
          movimiento_id: m.movimiento_id,
          caja_id: m.caja_id,
          caja: caja.nombre,
          grupo: caja.grupo,
          moneda: caja.moneda,
          fecha: m.fecha,
          sentido: m.sentido,
          monto: m.monto,
          origen: m.origen,
          comprobante_id: m.comprobante_id,
          es_transferencia_interna: m.es_transferencia_interna
        };
      })
  };
}

// Últimos N meses terminando en `mesFinal` (AAAA-MM), del más viejo al más nuevo.
export function ultimosMeses(mesFinal: string, n: number): string[] {
  const [a, m] = mesFinal.split("-").map(Number);
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  return meses;
}

// "Pendiente hoy" de los comprobantes devengados en `mes`: lo que falta
// cobrar/pagar contando TODAS las aplicaciones registradas hasta ahora
// (incluso las posteriores al cierre del mes). Se muestra al lado del
// "pendiente al cierre" (congelado en el snapshot) para ver cuánto se
// cobró o pagó después.
export function pendienteHoy(mes: string, datos: DatosCierre): { porCobrar: number; porPagar: number } {
  const { desde, hasta } = rangoMes(mes);
  const aplicadoPor = new Map<string, number>();
  for (const a of datos.aplicaciones) {
    if (a.anulado) continue;
    aplicadoPor.set(a.comprobante_id, (aplicadoPor.get(a.comprobante_id) ?? 0) + a.monto);
  }
  let porCobrar = 0;
  let porPagar = 0;
  for (const c of datos.comprobantes) {
    if (c.anulado || c.fecha_devengo < desde || c.fecha_devengo > hasta) continue;
    const pendiente = Math.max(c.monto_total - (aplicadoPor.get(c.comprobante_id) ?? 0), 0);
    if (c.tipo === "ingreso") porCobrar += pendiente;
    else porPagar += pendiente;
  }
  return { porCobrar: r2(porCobrar), porPagar: r2(porPagar) };
}

// Junta la rentabilidad de varios meses (p. ej. los últimos 12): por caso
// suma lo devengado en cada mes, y de ahí sale el ranking por aseguradora.
export function combinarRentabilidad(resultados: ResultadoCierre[]): {
  casos: RentabilidadCaso[];
  aseguradoras: RentabilidadAseguradora[];
} {
  const casos = new Map<string, RentabilidadCaso>();
  for (const res of resultados) {
    for (const c of res.rentabilidad_por_caso) {
      const x = casos.get(c.caso_id) ?? {
        caso_id: c.caso_id,
        aseguradora_id: c.aseguradora_id ?? null,
        ingresos: 0,
        egresos: 0,
        resultado: 0
      };
      x.ingresos = r2(x.ingresos + c.ingresos);
      x.egresos = r2(x.egresos + c.egresos);
      x.resultado = r2(x.ingresos - x.egresos);
      casos.set(c.caso_id, x);
    }
  }
  const listaCasos = Array.from(casos.values()).sort((a, b) => b.resultado - a.resultado);

  const porAseg = new Map<string, RentabilidadAseguradora>();
  for (const c of listaCasos) {
    const clave = c.aseguradora_id ?? "sin";
    const x = porAseg.get(clave) ?? {
      aseguradora_id: c.aseguradora_id ?? null,
      casos: 0,
      ingresos: 0,
      egresos: 0,
      resultado: 0,
      margen: null
    };
    x.casos += 1;
    x.ingresos = r2(x.ingresos + c.ingresos);
    x.egresos = r2(x.egresos + c.egresos);
    x.resultado = r2(x.ingresos - x.egresos);
    porAseg.set(clave, x);
  }
  const aseguradoras = Array.from(porAseg.values())
    .map((a) => ({ ...a, margen: a.ingresos === 0 ? null : r2((a.resultado / a.ingresos) * 100) }))
    .sort((a, b) => b.resultado - a.resultado);

  return { casos: listaCasos, aseguradoras };
}
