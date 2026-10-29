import ExcelJS from "exceljs";
import { ESTADOS, RAMAS } from "@/types/database";

export const SELECT_CASOS = `
  numero_siniestro, estado, rama, tipo_tramite, tramitador_nombre,
  fecha_ingreso, fecha_cierre, deuda_patentes, deuda_multas, observaciones,
  aseguradora:aseguradoras(nombre),
  asegurado:asegurados(nombre, dni, telefono, email),
  vehiculo:vehiculos(dominio, marca, modelo, anio, tipo_vehiculo),
  desarmadero:desarmaderos(nombre),
  registro:registros_automotores(numero),
  tipo_baja:tipos_baja(nombre),
  responsable:usuarios(nombre),
  movimientos_caso(monto, moneda, pagado, fecha, fecha_pago, anulado, aprobado, concepto:conceptos_movimiento(nombre, tipo)),
  facturas(tipo_receptor, cobros(monto, moneda, fecha, anulado))
`;

// Conceptos del circuito de cobros y pagos del caso que se vuelcan al Excel.
const CONCEPTO_COBRO_DESARMADERO = "Cobro al desarmadero";
const CONCEPTO_PAGO_COMPANIA = "Pago a la compañía";
const CONCEPTO_COBRO_COMPANIA = "Cobro a la aseguradora";
const CONCEPTO_PAGO_GESTORIA = "Honorarios por Gestoría";

interface MovimientoExport {
  monto: number;
  moneda: string | null;
  pagado: boolean;
  fecha: string;
  fecha_pago: string | null;
  anulado: boolean;
  aprobado: boolean;
  concepto: { nombre: string; tipo: string } | null;
}
interface FacturaExport {
  tipo_receptor: string;
  cobros: { monto: number; moneda: string | null; fecha: string; anulado: boolean }[];
}

const esPesos = (moneda: string | null | undefined) => !moneda || moneda === "ARS";
const masReciente = (fechas: (string | null | undefined)[]): string => {
  const validas = fechas.filter((f): f is string => !!f).sort();
  return validas.length ? validas[validas.length - 1] : "";
};

// Monto cargado (suma de los movimientos vigentes del concepto, en pesos) y
// fecha del último pago efectuado — vacía si todavía no se pagó nada.
function resumenEgreso(movs: MovimientoExport[], concepto: string) {
  const propios = movs.filter(
    (m) => m.concepto?.nombre === concepto && m.concepto.tipo === "egreso" && !m.anulado && m.aprobado && esPesos(m.moneda)
  );
  if (propios.length === 0) return { monto: "" as number | "", fecha: "" };
  return {
    monto: propios.reduce((a, m) => a + Number(m.monto), 0),
    fecha: masReciente(propios.filter((m) => m.pagado).map((m) => m.fecha_pago ?? m.fecha))
  };
}

// Monto cargado del ingreso y fecha del último cobro registrado contra las
// facturas de ese receptor — vacía si todavía no se cobró nada.
function resumenIngreso(movs: MovimientoExport[], facturas: FacturaExport[], concepto: string, receptor: string) {
  const propios = movs.filter(
    (m) => m.concepto?.nombre === concepto && m.concepto.tipo === "ingreso" && !m.anulado && esPesos(m.moneda)
  );
  const cobros = facturas
    .filter((f) => f.tipo_receptor === receptor)
    .flatMap((f) => f.cobros)
    .filter((c) => !c.anulado && esPesos(c.moneda));
  if (propios.length === 0 && cobros.length === 0) return { monto: "" as number | "", fecha: "" };
  return {
    monto: propios.reduce((a, m) => a + Number(m.monto), 0),
    fecha: masReciente(cobros.map((c) => c.fecha))
  };
}

// Columnas del reporte. `texto` = se guarda como texto en el Excel para que
// no pierda ceros a la izquierda ni se convierta en notación científica
// (números de siniestro, DNI, teléfonos, registros).
export const COLUMNAS: { key: string; label: string; ancho: number; tipo?: "texto" | "fecha" | "numero" | "moneda" }[] = [
  { key: "numero_siniestro", label: "N° Siniestro", ancho: 18, tipo: "texto" },
  { key: "aseguradora", label: "Aseguradora", ancho: 30 },
  { key: "asegurado", label: "Asegurado", ancho: 30 },
  { key: "dni_asegurado", label: "DNI Asegurado", ancho: 14, tipo: "texto" },
  { key: "telefono_asegurado", label: "Teléfono Asegurado", ancho: 18, tipo: "texto" },
  { key: "email_asegurado", label: "Email Asegurado", ancho: 28 },
  { key: "dominio", label: "Dominio", ancho: 11, tipo: "texto" },
  { key: "marca", label: "Marca", ancho: 14 },
  { key: "modelo", label: "Modelo", ancho: 28 },
  { key: "anio", label: "Año", ancho: 7, tipo: "numero" },
  { key: "tipo_unidad", label: "Tipo de unidad", ancho: 14 },
  { key: "desarmadero", label: "Desarmadero", ancho: 22 },
  { key: "registro", label: "Registro Automotor", ancho: 12, tipo: "texto" },
  { key: "tipo_baja", label: "Tipo de Baja", ancho: 14 },
  { key: "responsable", label: "Responsable", ancho: 18 },
  { key: "tramitador", label: "Trámitador de la Compañía", ancho: 24 },
  { key: "estado", label: "Estado", ancho: 24 },
  { key: "rama", label: "Rama", ancho: 18 },
  { key: "tipo_tramite", label: "Tipo de Trámite", ancho: 14 },
  { key: "fecha_ingreso", label: "Fecha Ingreso", ancho: 13, tipo: "fecha" },
  { key: "fecha_cierre", label: "Fecha Cierre", ancho: 13, tipo: "fecha" },
  { key: "deuda_patentes", label: "Deuda Patentes", ancho: 16, tipo: "moneda" },
  { key: "deuda_multas", label: "Deuda Multas", ancho: 16, tipo: "moneda" },
  { key: "observaciones", label: "Observaciones", ancho: 50 },
  { key: "cobro_desarmadero_monto", label: "Cobro desarmadero - Monto", ancho: 18, tipo: "moneda" },
  { key: "cobro_desarmadero_fecha", label: "Cobro desarmadero - Fecha de cobro", ancho: 18, tipo: "fecha" },
  { key: "pago_compania_monto", label: "Pago a compañía - Monto", ancho: 18, tipo: "moneda" },
  { key: "pago_compania_fecha", label: "Pago a compañía - Fecha de pago", ancho: 18, tipo: "fecha" },
  { key: "cobro_compania_monto", label: "Cobro a compañía - Monto", ancho: 18, tipo: "moneda" },
  { key: "cobro_compania_fecha", label: "Cobro a compañía - Fecha de cobro", ancho: 18, tipo: "fecha" },
  { key: "pago_gestoria_monto", label: "Pago a gestoría - Monto", ancho: 18, tipo: "moneda" },
  { key: "pago_gestoria_fecha", label: "Pago a gestoría - Fecha de pago", ancho: 18, tipo: "fecha" }
];

export function aFila(c: any): Record<string, any> {
  const movs: MovimientoExport[] = c.movimientos_caso ?? [];
  const facturas: FacturaExport[] = c.facturas ?? [];
  const cobroDesarmadero = resumenIngreso(movs, facturas, CONCEPTO_COBRO_DESARMADERO, "desarmadero");
  const pagoCompania = resumenEgreso(movs, CONCEPTO_PAGO_COMPANIA);
  const cobroCompania = resumenIngreso(movs, facturas, CONCEPTO_COBRO_COMPANIA, "compania");
  const pagoGestoria = resumenEgreso(movs, CONCEPTO_PAGO_GESTORIA);
  return {
    cobro_desarmadero_monto: cobroDesarmadero.monto,
    cobro_desarmadero_fecha: cobroDesarmadero.fecha,
    pago_compania_monto: pagoCompania.monto,
    pago_compania_fecha: pagoCompania.fecha,
    cobro_compania_monto: cobroCompania.monto,
    cobro_compania_fecha: cobroCompania.fecha,
    pago_gestoria_monto: pagoGestoria.monto,
    pago_gestoria_fecha: pagoGestoria.fecha,
    numero_siniestro: (c.numero_siniestro ?? "").trim(),
    aseguradora: c.aseguradora?.nombre ?? "",
    asegurado: c.asegurado?.nombre ?? "",
    dni_asegurado: c.asegurado?.dni ?? "",
    telefono_asegurado: c.asegurado?.telefono ?? "",
    email_asegurado: c.asegurado?.email ?? "",
    dominio: c.vehiculo?.dominio ?? "",
    marca: c.vehiculo?.marca ?? "",
    modelo: c.vehiculo?.modelo ?? "",
    anio: c.vehiculo?.anio ?? "",
    tipo_unidad: c.vehiculo?.tipo_vehiculo ?? "",
    desarmadero: c.desarmadero?.nombre ?? "",
    registro: c.registro?.numero ?? "",
    tipo_baja: c.tipo_baja?.nombre ?? "",
    responsable: c.responsable?.nombre ?? "",
    tramitador: c.tramitador_nombre ?? "",
    estado: ESTADOS.find((e) => e.value === c.estado)?.label ?? c.estado,
    rama: RAMAS.find((r) => r.value === c.rama)?.label ?? c.rama ?? "",
    tipo_tramite: c.tipo_tramite ?? "",
    fecha_ingreso: c.fecha_ingreso,
    fecha_cierre: c.fecha_cierre ?? "",
    deuda_patentes: c.deuda_patentes ?? 0,
    deuda_multas: c.deuda_multas ?? 0,
    observaciones: c.observaciones ?? ""
  };
}

export function fechaComoDate(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const [a, m, d] = valor.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

// Arma el Excel del reporte de Casos: filtros en el encabezado, fechas
// reales y los identificadores guardados como texto.
export async function generarXlsxCasos(filas: Record<string, any>[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();
  const hoja = libro.addWorksheet("Casos");
  hoja.columns = COLUMNAS.map((c) => ({ header: c.label, key: c.key, width: c.ancho }));

  const cab = hoja.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
  cab.alignment = { vertical: "middle", wrapText: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  COLUMNAS.forEach((col, i) => {
    const columna = hoja.getColumn(i + 1);
    if (col.tipo === "texto") columna.numFmt = "@";
    else if (col.tipo === "fecha") columna.numFmt = "dd/mm/yyyy";
    else if (col.tipo === "moneda") columna.numFmt = "#,##0.00";
  });

  for (const f of filas) {
    const valores: Record<string, any> = { ...f };
    for (const col of COLUMNAS) {
      const v = f[col.key];
      if (col.tipo === "texto") valores[col.key] = v === null || v === undefined ? "" : String(v);
      else if (col.tipo === "fecha") valores[col.key] = fechaComoDate(v);
      else if (col.tipo === "numero") valores[col.key] = v === "" || v === null ? null : Number(v);
      else if (col.tipo === "moneda") valores[col.key] = v === "" || v === null || v === undefined ? null : Number(v) || 0;
    }
    hoja.addRow(valores);
  }

  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };
  return Buffer.from((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}
