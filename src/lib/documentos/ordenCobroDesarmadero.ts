import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface DatosOrdenCobro {
  numeroFactura: number;
  numeroSiniestro: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  formaPago: string | null;
  desarmaderoNombre: string;
  tipoBajaNombre: string | null;
  vehiculoDominio: string;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoAnio: number | null;
  servicios: { concepto: string; monto: number }[];
  valorMercado: number | null;
  valorOtros: number;
  total: number;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 67.5;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearMoneda(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// Documento corto (lista campo/valor + detalle de servicios), generado
// directo con pdf-lib, mismo criterio de fuentes que
// autorizacionRetiroPdf.ts. Con `asegurarEspacio` puede saltar de
// página si el detalle de servicios es largo, aunque en la práctica
// suele entrar en una sola.
export async function generarOrdenCobroDesarmadero(datos: DatosOrdenCobro): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const TITLE_SIZE = 14;
  const LABEL_SIZE = 10;
  const LINE_HEIGHT = 22;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function asegurarEspacio(alturaNecesaria: number) {
    if (y - alturaNecesaria < MARGIN_BOTTOM) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  function fila(etiqueta: string, valor: string, separadorAntes = false) {
    asegurarEspacio(LINE_HEIGHT + (separadorAntes ? 10 : 0));
    if (separadorAntes) {
      page.drawLine({
        start: { x: MARGIN_X, y: y + 8 },
        end: { x: MARGIN_X + CONTENT_WIDTH, y: y + 8 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8)
      });
      y -= 10;
    }
    page.drawText(etiqueta, { x: MARGIN_X, y, size: LABEL_SIZE, font: bold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(valor, {
      x: MARGIN_X + 180,
      y,
      size: LABEL_SIZE,
      font: regular,
      color: rgb(0, 0, 0)
    });
    y -= LINE_HEIGHT;
  }

  page.drawText("Orden de cobro — Desarmadero", {
    x: MARGIN_X,
    y,
    size: TITLE_SIZE,
    font: bold,
    color: rgb(0, 0, 0)
  });
  y -= TITLE_SIZE + 6;
  page.drawText(`Factura N° ${datos.numeroFactura} · Siniestro N° ${datos.numeroSiniestro}`, {
    x: MARGIN_X,
    y,
    size: LABEL_SIZE,
    font: regular,
    color: rgb(0.35, 0.35, 0.35)
  });
  y -= LINE_HEIGHT + 10;

  fila("Fecha", formatearFecha(datos.fechaEmision));
  fila("Desarmadero", datos.desarmaderoNombre);
  fila("Tipo de baja", datos.tipoBajaNombre ?? "—");

  fila("Patente", datos.vehiculoDominio, true);
  fila("Marca", datos.vehiculoMarca ?? "—");
  fila("Modelo", datos.vehiculoModelo ?? "—");
  fila("Año", datos.vehiculoAnio ? String(datos.vehiculoAnio) : "—");

  // Detalle de servicios/movimientos que componen la factura — antes
  // solo se veía el agregado "Valor otros", sin decir qué se estaba
  // facturando en concreto.
  asegurarEspacio(LINE_HEIGHT + 10);
  page.drawLine({
    start: { x: MARGIN_X, y: y + 8 },
    end: { x: MARGIN_X + CONTENT_WIDTH, y: y + 8 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });
  y -= 10;
  page.drawText("Servicios / movimientos facturados", {
    x: MARGIN_X,
    y,
    size: LABEL_SIZE,
    font: bold,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= LINE_HEIGHT;
  if (datos.servicios.length === 0) {
    asegurarEspacio(LINE_HEIGHT);
    page.drawText("Sin movimientos cargados.", {
      x: MARGIN_X,
      y,
      size: LABEL_SIZE,
      font: regular,
      color: rgb(0.4, 0.4, 0.4)
    });
    y -= LINE_HEIGHT;
  } else {
    for (const servicio of datos.servicios) {
      asegurarEspacio(LINE_HEIGHT);
      page.drawText(servicio.concepto, { x: MARGIN_X, y, size: LABEL_SIZE, font: regular, color: rgb(0, 0, 0) });
      const montoTexto = formatearMoneda(servicio.monto);
      const anchoMonto = regular.widthOfTextAtSize(montoTexto, LABEL_SIZE);
      page.drawText(montoTexto, {
        x: MARGIN_X + CONTENT_WIDTH - anchoMonto,
        y,
        size: LABEL_SIZE,
        font: regular,
        color: rgb(0, 0, 0)
      });
      y -= LINE_HEIGHT;
    }
  }

  fila("Valor InfoAuto", formatearMoneda(datos.valorMercado), true);
  fila("Valor otros", formatearMoneda(datos.valorOtros));
  fila("Total", formatearMoneda(datos.total));

  fila("Fecha de vencimiento", formatearFecha(datos.fechaVencimiento), true);
  fila("Forma de pago", datos.formaPago ?? "—");

  return Buffer.from(await doc.save());
}
