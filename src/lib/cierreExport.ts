import ExcelJS from "exceljs";
import { combinarRentabilidad } from "./cierreMensual";
import type { LineaCierre, ResultadoCierre } from "./cierreMensual";

export interface ContextoExport {
  // Etiquetas legibles que no viven en el resultado.
  casoLabel: Map<string, string>;
  aseguradoraNombre: Map<string, string>;
  cajaNombre: Map<string, string>;
  transferencias: {
    fecha: string;
    origen: string;
    destino: string;
    monto: number;
    referencia: string | null;
    anulado: boolean;
    anulado_motivo: string | null;
  }[];
  comparativo: ResultadoCierre[];
  // True si el reporte sale del snapshot congelado al cierre.
  congelado: boolean;
  generadoPor?: string;
}

const FORMATO_MONTO = '#,##0.00;[Red]-#,##0.00';
const AZUL = "FF1F3A5F";

function encabezado(hoja: ExcelJS.Worksheet, columnas: { header: string; key: string; width: number; numerico?: boolean }[]) {
  hoja.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  fila.alignment = { vertical: "middle", wrapText: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  columnas.forEach((c, i) => {
    if (c.numerico) hoja.getColumn(i + 1).numFmt = FORMATO_MONTO;
  });
}

function fechaCorta(f: string | null): string {
  if (!f) return "";
  const [a, m, d] = f.split("-");
  return `${d}/${m}/${a}`;
}

export function filasLinea(l: LineaCierre, ctx: ContextoExport) {
  return {
    linea: l.linea,
    comprobante_id: l.comprobante_id,
    caso: l.caso_id ? ctx.casoLabel.get(l.caso_id) ?? l.caso_id : "Sin caso",
    aseguradora: l.aseguradora_id ? ctx.aseguradoraNombre.get(l.aseguradora_id) ?? "" : "",
    contraparte: l.contraparte ?? "",
    categoria: l.categoria ?? "",
    numero: l.numero ?? "",
    fecha_devengo: fechaCorta(l.fecha_devengo),
    fecha_aplicacion: fechaCorta(l.fecha_aplicacion),
    caja: l.caja_id ? ctx.cajaNombre.get(l.caja_id) ?? "" : "",
    neto: l.neto,
    iva: l.iva,
    total: l.total,
    aplicado: l.aplicado,
    pendiente: l.pendiente,
    total_comprobante: l.total_comprobante
  };
}

const COLUMNAS_LINEA = [
  { header: "Línea", key: "linea", width: 34 },
  { header: "ID comprobante", key: "comprobante_id", width: 40 },
  { header: "Caso", key: "caso", width: 24 },
  { header: "Aseguradora", key: "aseguradora", width: 24 },
  { header: "Contraparte", key: "contraparte", width: 26 },
  { header: "Categoría", key: "categoria", width: 26 },
  { header: "N° comprobante", key: "numero", width: 14 },
  { header: "Fecha devengo", key: "fecha_devengo", width: 13 },
  { header: "Fecha cobro/pago", key: "fecha_aplicacion", width: 15 },
  { header: "Caja", key: "caja", width: 22 },
  { header: "Neto", key: "neto", width: 15, numerico: true },
  { header: "IVA", key: "iva", width: 13, numerico: true },
  { header: "Total", key: "total", width: 15, numerico: true },
  { header: "Aplicado", key: "aplicado", width: 15, numerico: true },
  { header: "Pendiente", key: "pendiente", width: 15, numerico: true },
  { header: "Total del comprobante", key: "total_comprobante", width: 18, numerico: true }
];

// Columnas (letra) de las hojas de detalle, para las fórmulas del Resumen.
const COL = { linea: "A", neto: "K", total: "M" };

function hojaDetalle(libro: ExcelJS.Workbook, nombre: string, lineas: LineaCierre[], ctx: ContextoExport) {
  const hoja = libro.addWorksheet(nombre);
  encabezado(hoja, COLUMNAS_LINEA);
  for (const l of lineas) hoja.addRow(filasLinea(l, ctx));
  return hoja;
}

export async function generarXlsxCierre(r: ResultadoCierre, ctx: ContextoExport): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = ctx.generadoPor ?? "Oltra Bajas";
  libro.created = new Date();

  const resumen = libro.addWorksheet("Resumen");

  hojaDetalle(libro, "A_Ingresos_mes", r.lineas.filter((l) => l.bloque === "A"), ctx);
  hojaDetalle(libro, "B_Egresos_mes", r.lineas.filter((l) => l.bloque === "B"), ctx);
  hojaDetalle(libro, "C_Movimientos_anteriores", r.lineas.filter((l) => l.bloque === "C"), ctx);

  // ---- D_Cajas: libro de caja del mes ----
  const hojaD = libro.addWorksheet("D_Cajas");
  encabezado(hojaD, [
    { header: "Caja", key: "caja", width: 26 },
    { header: "Grupo", key: "grupo", width: 10 },
    { header: "Moneda", key: "moneda", width: 9 },
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Entrada", key: "entrada", width: 16, numerico: true },
    { header: "Salida", key: "salida", width: 16, numerico: true },
    { header: "Origen", key: "origen", width: 22 },
    { header: "ID comprobante", key: "comprobante_id", width: 40 },
    { header: "Transferencia interna", key: "trf", width: 14 },
    { header: "ID movimiento", key: "movimiento_id", width: 40 }
  ]);
  for (const m of r.movimientos_caja) {
    hojaD.addRow({
      caja: m.caja,
      grupo: m.grupo === "bancos" ? "Bancos" : "Efectivo",
      moneda: m.moneda,
      fecha: fechaCorta(m.fecha),
      entrada: m.sentido === "entrada" ? m.monto : 0,
      salida: m.sentido === "salida" ? m.monto : 0,
      origen: m.origen,
      comprobante_id: m.comprobante_id ?? "",
      trf: m.es_transferencia_interna ? "SI" : "NO",
      movimiento_id: m.movimiento_id
    });
  }
  const ultimaD = Math.max(hojaD.rowCount, 2);

  // ---- Conciliacion_Cajas ----
  const hojaConc = libro.addWorksheet("Conciliacion_Cajas");
  encabezado(hojaConc, [
    { header: "Caja", key: "caja", width: 28 },
    { header: "Grupo", key: "grupo", width: 10 },
    { header: "Moneda", key: "moneda", width: 9 },
    { header: "Saldo inicial", key: "ini", width: 17, numerico: true },
    { header: "Entradas", key: "ent", width: 17, numerico: true },
    { header: "Salidas", key: "sal", width: 17, numerico: true },
    { header: "Saldo calculado", key: "calc", width: 17, numerico: true },
    { header: "Saldo real declarado", key: "decl", width: 19, numerico: true },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Diferencia", key: "dif", width: 15, numerico: true },
    { header: "Lectura", key: "lectura", width: 18 }
  ]);
  r.cajas.forEach((c, i) => {
    const n = i + 2;
    hojaConc.addRow({
      caja: c.nombre,
      grupo: c.grupo === "bancos" ? "Bancos" : "Efectivo",
      moneda: c.moneda,
      ini: c.saldo_inicial_periodo,
      ent: { formula: `SUMIFS(D_Cajas!$E$2:$E$${ultimaD},D_Cajas!$A$2:$A$${ultimaD},A${n})`, result: c.entradas },
      sal: { formula: `SUMIFS(D_Cajas!$F$2:$F$${ultimaD},D_Cajas!$A$2:$A$${ultimaD},A${n})`, result: c.salidas },
      calc: { formula: `D${n}+E${n}-F${n}`, result: c.saldo_calculado },
      decl: c.saldo_declarado ?? "",
      tipo: c.tipo_declarado ?? "",
      dif: {
        formula: `IF(H${n}="","",H${n}-G${n})`,
        result: c.diferencia ?? ""
      },
      lectura: {
        formula: `IF(H${n}="","Sin declarar",IF(ROUND(J${n},2)=0,"OK",IF(I${n}="arqueo",IF(J${n}<0,"Faltante de arqueo","Sobrante de arqueo"),"Revisar extracto")))`,
        result:
          c.diferencia === null
            ? "Sin declarar"
            : c.diferencia === 0
              ? "OK"
              : c.tipo_declarado === "arqueo"
                ? c.diferencia < 0 ? "Faltante de arqueo" : "Sobrante de arqueo"
                : "Revisar extracto"
      }
    });
  });
  const ultimaConc = Math.max(hojaConc.rowCount, 2);

  // ---- Transferencias_internas ----
  const hojaT = libro.addWorksheet("Transferencias_internas");
  encabezado(hojaT, [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Desde caja", key: "origen", width: 28 },
    { header: "Hacia caja", key: "destino", width: 28 },
    { header: "Monto", key: "monto", width: 16, numerico: true },
    { header: "Referencia", key: "referencia", width: 28 },
    { header: "Estado", key: "estado", width: 30 }
  ]);
  for (const t of ctx.transferencias) {
    hojaT.addRow({
      fecha: fechaCorta(t.fecha),
      origen: t.origen,
      destino: t.destino,
      monto: t.monto,
      referencia: t.referencia ?? "",
      estado: t.anulado ? `Anulada${t.anulado_motivo ? ` — ${t.anulado_motivo}` : ""}` : "Vigente"
    });
  }
  const filaCheck = hojaT.rowCount + 2;
  hojaT.getCell(`A${filaCheck}`).value = "Verificación (hoja D_Cajas, solo transferencias internas):";
  hojaT.getCell(`A${filaCheck}`).font = { bold: true };
  hojaT.getCell(`A${filaCheck + 1}`).value = "Entradas";
  hojaT.getCell(`D${filaCheck + 1}`).value = {
    formula: `SUMIFS(D_Cajas!$E$2:$E$${ultimaD},D_Cajas!$I$2:$I$${ultimaD},"SI",D_Cajas!$C$2:$C$${ultimaD},"ARS")`,
    result: r.movimientos_caja.filter((m) => m.es_transferencia_interna && m.sentido === "entrada" && m.moneda === "ARS").reduce((a, m) => a + m.monto, 0)
  };
  hojaT.getCell(`A${filaCheck + 2}`).value = "Salidas";
  hojaT.getCell(`D${filaCheck + 2}`).value = {
    formula: `SUMIFS(D_Cajas!$F$2:$F$${ultimaD},D_Cajas!$I$2:$I$${ultimaD},"SI",D_Cajas!$C$2:$C$${ultimaD},"ARS")`,
    result: r.movimientos_caja.filter((m) => m.es_transferencia_interna && m.sentido === "salida" && m.moneda === "ARS").reduce((a, m) => a + m.monto, 0)
  };
  hojaT.getCell(`A${filaCheck + 3}`).value = "Diferencia (debe ser 0)";
  hojaT.getCell(`D${filaCheck + 3}`).value = { formula: `D${filaCheck + 1}-D${filaCheck + 2}`, result: 0 };
  for (const f of [filaCheck + 1, filaCheck + 2, filaCheck + 3]) hojaT.getCell(`D${f}`).numFmt = FORMATO_MONTO;

  // ---- Comparativo_12m ----
  const hojaC = libro.addWorksheet("Comparativo_12m");
  encabezado(hojaC, [
    { header: "Mes", key: "mes", width: 10 },
    { header: "Ingresos", key: "ing", width: 17, numerico: true },
    { header: "Egresos", key: "egr", width: 17, numerico: true },
    { header: "Ganancia", key: "gan", width: 17, numerico: true },
    { header: "ROI %", key: "roi", width: 11 },
    { header: "Margen %", key: "mar", width: 11 },
    { header: "Saldo de cajas", key: "saldo", width: 18, numerico: true }
  ]);
  ctx.comparativo.forEach((c, i) => {
    const n = i + 2;
    hojaC.addRow({
      mes: c.mes,
      ing: c.ingresos,
      egr: c.egresos,
      gan: { formula: `B${n}-C${n}`, result: c.ganancia },
      roi: { formula: `IF(C${n}=0,"N/A",ROUND(D${n}/C${n}*100,2))`, result: c.roi ?? "N/A" },
      mar: { formula: `IF(B${n}=0,"N/A",ROUND(D${n}/B${n}*100,2))`, result: c.margen ?? "N/A" },
      saldo: c.saldo_cajas_total
    });
  });

  // ---- Rentabilidad_por_caso ----
  const hojaR = libro.addWorksheet("Rentabilidad_por_caso");
  encabezado(hojaR, [
    { header: "Caso", key: "caso", width: 28 },
    { header: "Ingresos (neto)", key: "ing", width: 18, numerico: true },
    { header: "Egresos (neto)", key: "egr", width: 18, numerico: true },
    { header: "Resultado", key: "res", width: 18, numerico: true }
  ]);
  r.rentabilidad_por_caso.forEach((c, i) => {
    const n = i + 2;
    hojaR.addRow({
      caso: ctx.casoLabel.get(c.caso_id) ?? c.caso_id,
      ing: c.ingresos,
      egr: c.egresos,
      res: { formula: `B${n}-C${n}`, result: c.resultado }
    });
  });

  // ---- Rentabilidad_por_aseguradora ----
  const hojaRA = libro.addWorksheet("Rentabilidad_por_aseguradora");
  encabezado(hojaRA, [
    { header: "Aseguradora", key: "aseg", width: 32 },
    { header: "Casos", key: "casos", width: 9 },
    { header: "Ingresos (neto)", key: "ing", width: 18, numerico: true },
    { header: "Egresos (neto)", key: "egr", width: 18, numerico: true },
    { header: "Resultado", key: "res", width: 18, numerico: true },
    { header: "Margen %", key: "mar", width: 11 }
  ]);
  combinarRentabilidad([r]).aseguradoras.forEach((a, i) => {
    const n = i + 2;
    hojaRA.addRow({
      aseg: a.aseguradora_id ? ctx.aseguradoraNombre.get(a.aseguradora_id) ?? "—" : "Sin aseguradora",
      casos: a.casos,
      ing: a.ingresos,
      egr: a.egresos,
      res: { formula: `C${n}-D${n}`, result: a.resultado },
      mar: { formula: `IF(C${n}=0,"N/A",ROUND(E${n}/C${n}*100,2))`, result: a.margen ?? "N/A" }
    });
  });

  // ---- Resumen (fórmulas que leen el detalle) ----
  resumen.columns = [
    { header: "Concepto", key: "a", width: 58 },
    { header: "Desde el detalle (fórmula)", key: "b", width: 26 },
    { header: "Valor del sistema", key: "c", width: 22 },
    { header: "Control", key: "d", width: 12 }
  ];
  const cab = resumen.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  resumen.getColumn(2).numFmt = FORMATO_MONTO;
  resumen.getColumn(3).numFmt = FORMATO_MONTO;

  const nA = Math.max(r.lineas.filter((l) => l.bloque === "A").length + 1, 2);
  const nB = Math.max(r.lineas.filter((l) => l.bloque === "B").length + 1, 2);
  const nC = Math.max(r.lineas.filter((l) => l.bloque === "C").length + 1, 2);
  const sumA = (linea: string, col = COL.neto) => `SUMIFS(A_Ingresos_mes!$${col}$2:$${col}$${nA},A_Ingresos_mes!$${COL.linea}$2:$${COL.linea}$${nA},"${linea}")`;
  const sumB = (linea: string, col = COL.neto) => `SUMIFS(B_Egresos_mes!$${col}$2:$${col}$${nB},B_Egresos_mes!$${COL.linea}$2:$${COL.linea}$${nB},"${linea}")`;
  const sumC = (linea: string) => `SUMIFS(C_Movimientos_anteriores!$${COL.total}$2:$${COL.total}$${nC},C_Movimientos_anteriores!$${COL.linea}$2:$${COL.linea}$${nC},"${linea}")`;

  let fila = 2;
  const titulo = (texto: string) => {
    resumen.getCell(`A${fila}`).value = texto;
    resumen.getCell(`A${fila}`).font = { bold: true };
    resumen.getCell(`A${fila}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
    fila++;
  };
  const linea = (texto: string, formula: string, valor: number | string, opciones?: { sinControl?: boolean; porcentaje?: boolean }) => {
    const n = fila++;
    resumen.getCell(`A${n}`).value = texto;
    resumen.getCell(`B${n}`).value = { formula, result: valor } as ExcelJS.CellFormulaValue;
    resumen.getCell(`C${n}`).value = valor;
    if (opciones?.porcentaje) {
      resumen.getCell(`B${n}`).numFmt = "0.00";
      resumen.getCell(`C${n}`).numFmt = "0.00";
    }
    if (!opciones?.sinControl) {
      resumen.getCell(`D${n}`).value = {
        formula: `IF(AND(ISNUMBER(B${n}),ISNUMBER(C${n})),IF(ABS(B${n}-C${n})<0.01,"OK","REVISAR"),IF(B${n}=C${n},"OK","REVISAR"))`,
        result: "OK"
      };
    }
    return n;
  };

  resumen.getCell(`A${fila}`).value = `Cierre mensual ${r.mes}${ctx.congelado ? " — congelado al cierre" : " — en vivo (mes abierto)"}`;
  resumen.getCell(`A${fila}`).font = { bold: true, size: 13 };
  fila += 2;

  titulo("A – INGRESOS DEL MES (devengado, neto de IVA)");
  const nA1 = linea("A1 Cobrado en el mes de comprobantes del mes", sumA("Cobrado en el mes"), r.A1_cobrado_mes);
  const nA2 = linea("A2 Pendiente de cobro al cierre de comprobantes del mes", sumA("Pendiente al cierre"), r.A2_pendiente_cierre);
  const nA3 = linea("A3 Cobrado antes del mes (cobros anticipados)", sumA("Cobrado antes del mes"), r.A3_cobrado_antes);
  const nA4 = linea("A4 Notas de crédito de períodos anteriores", sumA("Nota de crédito de períodos anteriores"), r.A4_notas_credito_anteriores);
  const nIng = linea("INGRESOS DEL MES", `SUM(B${nA1}:B${nA4})`, r.ingresos);
  fila++;

  titulo("B – EGRESOS DEL MES (devengado, neto de IVA)");
  const nB1 = linea("B1 Pagado en el mes de comprobantes del mes", sumB("Pagado en el mes"), r.B1_pagado_mes);
  const nB2 = linea("B2 Pendiente de pago al cierre de comprobantes del mes", sumB("Pendiente al cierre"), r.B2_pendiente_cierre);
  const nB3 = linea("B3 Pagado antes del mes (pagos anticipados)", sumB("Pagado antes del mes"), r.B3_pagado_antes);
  const nEgr = linea("EGRESOS DEL MES", `SUM(B${nB1}:B${nB3})`, r.egresos);
  fila++;

  titulo("INDICADORES");
  const nGan = linea("Ganancia real = ingresos − egresos", `B${nIng}-B${nEgr}`, r.ganancia);
  linea("ROI operativo % = ganancia / egresos", `IF(B${nEgr}=0,"N/A",ROUND(B${nGan}/B${nEgr}*100,2))`, r.roi ?? "N/A", { porcentaje: true });
  linea("Margen % = ganancia / ingresos", `IF(B${nIng}=0,"N/A",ROUND(B${nGan}/B${nIng}*100,2))`, r.margen ?? "N/A", { porcentaje: true });
  fila++;

  titulo("C – CAJA DE OTROS PERÍODOS (solo liquidez, con IVA, informativo)");
  linea("C1 Cobranzas de comprobantes de meses anteriores", sumC("Cobranza de período anterior"), r.C1_cobranzas_anteriores);
  linea("C2 Pagos de comprobantes de meses anteriores", sumC("Pago de período anterior"), r.C2_pagos_anteriores);
  linea("C3 Cobranzas anticipadas de meses posteriores", sumC("Cobranza anticipada"), r.C3_cobranzas_anticipadas);
  linea("C4 Pagos anticipados de meses posteriores", sumC("Pago anticipado"), r.C4_pagos_anticipados);
  fila++;

  titulo("D – LIQUIDEZ (Saldo de Cajas, solo cajas en pesos)");
  const rc = (col: string) => `Conciliacion_Cajas!$${col}$2:$${col}$${ultimaConc}`;
  const nIni = linea("Saldo inicial de las cajas al comienzo del mes", `SUMIFS(${rc("D")},${rc("C")},"ARS")`, r.saldo_inicial_total);
  const nBancos = linea("Saldo final calculado – Bancos", `SUMIFS(${rc("G")},${rc("C")},"ARS",${rc("B")},"Bancos")`, r.saldo_bancos);
  const nEfe = linea("Saldo final calculado – Efectivo", `SUMIFS(${rc("G")},${rc("C")},"ARS",${rc("B")},"Efectivo")`, r.saldo_efectivo);
  const nSaldo = linea("SALDO DE CAJAS (Bancos + Efectivo)", `B${nBancos}+B${nEfe}`, r.saldo_cajas_total);
  const rd = (col: string) => `D_Cajas!$${col}$2:$${col}$${ultimaD}`;
  const nCtrl = linea(
    "Control: saldo inicial + entradas − salidas (sin transferencias internas)",
    `B${nIni}+SUMIFS(${rd("E")},${rd("I")},"NO",${rd("C")},"ARS")-SUMIFS(${rd("F")},${rd("I")},"NO",${rd("C")},"ARS")`,
    r.saldo_cajas_total
  );
  void nCtrl;
  linea("Variación del Saldo de Cajas en el mes", `B${nSaldo}-B${nIni}`, r.variacion_saldo_cajas);
  fila++;

  titulo("POSICIÓN ACUMULADA (todos los períodos, al cierre del mes)");
  const nPC = linea("Total por cobrar acumulado", String(r.por_cobrar_acumulado), r.por_cobrar_acumulado, { sinControl: true });
  const nPP = linea("Total por pagar acumulado", String(r.por_pagar_acumulado), r.por_pagar_acumulado, { sinControl: true });
  linea("Capital de trabajo = Saldo de Cajas + por cobrar − por pagar", `B${nSaldo}+B${nPC}-B${nPP}`, r.capital_de_trabajo);

  fila++;
  resumen.getCell(`A${fila}`).value =
    "Las columnas B se calculan con fórmulas SUMIFS sobre las hojas de detalle: si cambiás o filtrás una fila del detalle, el total se recalcula. La columna C es el valor que calculó el sistema; D indica si coinciden.";
  resumen.getCell(`A${fila}`).alignment = { wrapText: true };
  resumen.mergeCells(`A${fila}:D${fila + 2}`);

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

export function nombreArchivoCierre(mes: string, extension: string, bloque?: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  return `cierre_${mes}${bloque ? `_${bloque}` : ""}_generado_${hoy}.${extension}`;
}
