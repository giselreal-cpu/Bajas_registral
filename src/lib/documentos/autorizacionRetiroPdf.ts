import { PDFDocument, PDFFont, PDFPage, PDFImage, StandardFonts, rgb } from "pdf-lib";
import type { DatosAutorizacion } from "./autorizacionRetiro";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function fechaLarga(): string {
  const hoy = new Date();
  return `Buenos Aires, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
}

// Página tamaño carta (igual que el .docx: 8.5x11" a 72pt/pulgada) con
// los mismos márgenes.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_TOP = 32.5;
const MARGIN_BOTTOM = 32.5;
const MARGIN_X = 67.5;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FONT_SIZE = 10;
const LINE_HEIGHT = 13;
const PARAGRAPH_GAP = 5;

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// Escribe párrafos/campos en un PDF de a una página, agregando páginas
// nuevas cuando el contenido no entra — pdf-lib no tiene motor de
// layout, así que la paginación se maneja a mano acá.
class EscritorPdf {
  private doc: PDFDocument;
  private page!: PDFPage;
  private y = 0;
  private fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont };

  private constructor(doc: PDFDocument, fonts: EscritorPdf["fonts"]) {
    this.doc = doc;
    this.fonts = fonts;
    this.nuevaPagina();
  }

  static async crear(doc: PDFDocument) {
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique)
    };
    return new EscritorPdf(doc, fonts);
  }

  private nuevaPagina() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private fuenteDe(seg: TextSegment): PDFFont {
    if (seg.bold) return this.fonts.bold;
    if (seg.italic) return this.fonts.italic;
    return this.fonts.regular;
  }

  private asegurarEspacio(alturaNecesaria: number) {
    if (this.y - alturaNecesaria < MARGIN_BOTTOM) {
      this.nuevaPagina();
    }
  }

  espacio(altura = LINE_HEIGHT) {
    this.y -= altura;
  }

  // Dibuja una imagen ya embebida (jpg/png) con un alto fijo, manteniendo
  // la relación de aspecto, en la coordenada x indicada.
  imagen(img: PDFImage, x: number, altura: number) {
    const escala = altura / img.height;
    const ancho = img.width * escala;
    this.asegurarEspacio(altura);
    this.page.drawImage(img, { x, y: this.y - altura, width: ancho, height: altura });
    return ancho;
  }

  // Dos bloques de texto en la misma línea (uno pegado al margen
  // izquierdo, otro pegado al derecho) — para pares tipo "Aseguradora /
  // Oltra" que tienen que quedar a la misma altura.
  lineaDual(izquierda: TextSegment[], derecha: TextSegment[]) {
    this.asegurarEspacio(LINE_HEIGHT);
    let x = MARGIN_X;
    for (const seg of izquierda) {
      const font = this.fuenteDe(seg);
      this.page.drawText(seg.text, { x, y: this.y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      x += font.widthOfTextAtSize(seg.text, FONT_SIZE);
    }
    const anchoDerecha = derecha.reduce(
      (acc, s) => acc + this.fuenteDe(s).widthOfTextAtSize(s.text, FONT_SIZE),
      0
    );
    x = MARGIN_X + CONTENT_WIDTH - anchoDerecha;
    for (const seg of derecha) {
      const font = this.fuenteDe(seg);
      this.page.drawText(seg.text, { x, y: this.y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      x += font.widthOfTextAtSize(seg.text, FONT_SIZE);
    }
    this.y -= LINE_HEIGHT;
  }

  // Una línea simple sin wrap (para campos cortos tipo "Etiqueta: valor").
  linea(segmentos: TextSegment[], opciones: { align?: "left" | "right" } = {}) {
    this.asegurarEspacio(LINE_HEIGHT);
    let x = MARGIN_X;
    if (opciones.align === "right") {
      const anchoTotal = segmentos.reduce(
        (acc, s) => acc + this.fuenteDe(s).widthOfTextAtSize(s.text, FONT_SIZE),
        0
      );
      x = MARGIN_X + CONTENT_WIDTH - anchoTotal;
    }
    for (const seg of segmentos) {
      const font = this.fuenteDe(seg);
      this.page.drawText(seg.text, { x, y: this.y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      const ancho = font.widthOfTextAtSize(seg.text, FONT_SIZE);
      if (seg.underline) {
        this.page.drawLine({
          start: { x, y: this.y - 1.5 },
          end: { x: x + ancho, y: this.y - 1.5 },
          thickness: 0.5,
          color: rgb(0, 0, 0)
        });
      }
      x += ancho;
    }
    this.y -= LINE_HEIGHT;
  }

  // Párrafo largo (un solo estilo), envuelto por ancho de página.
  parrafo(text: string, opciones: { bold?: boolean; italic?: boolean } = {}) {
    const font = opciones.bold ? this.fonts.bold : opciones.italic ? this.fonts.italic : this.fonts.regular;
    const palabras = text.split(" ");
    let actual = "";
    const lineas: string[] = [];
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, FONT_SIZE) > CONTENT_WIDTH && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);

    for (const linea of lineas) {
      this.asegurarEspacio(LINE_HEIGHT);
      this.page.drawText(linea, { x: MARGIN_X, y: this.y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      this.y -= LINE_HEIGHT;
    }
    this.y -= PARAGRAPH_GAP;
  }

  lineaHorizontal() {
    this.asegurarEspacio(4);
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y },
      thickness: 0.75,
      color: rgb(0, 0, 0)
    });
    this.y -= 8;
  }

  async bytes(): Promise<Buffer> {
    return Buffer.from(await this.doc.save());
  }
}

function campo(w: EscritorPdf, etiqueta: string, valor: string | null) {
  w.linea([{ text: `${etiqueta}: `, bold: true }, { text: valor ?? "" }]);
}

function camposEnLinea(w: EscritorPdf, pares: [string, string | null][]) {
  const segmentos: TextSegment[] = [];
  pares.forEach(([etiqueta, valor], i) => {
    if (i > 0) segmentos.push({ text: "     " });
    segmentos.push({ text: `${etiqueta}: `, bold: true }, { text: valor ?? "" });
  });
  w.linea(segmentos);
}

export async function generarAutorizacionPdf(datos: DatosAutorizacion): Promise<Buffer> {
  const hayTercero = !!datos.terceroNombre;
  const entregaNombre = hayTercero ? datos.terceroNombre : datos.aseguradoNombre;
  const entregaDni = hayTercero ? datos.terceroDni : datos.aseguradoDni;
  const entregaTelefono = hayTercero ? datos.terceroContacto : datos.aseguradoTelefono;

  const doc = await PDFDocument.create();
  const w = await EscritorPdf.crear(doc);

  const ALTO_LOGO = 40;
  if (datos.logoAseguradoraBuffer) {
    const img =
      (await intentarEmbeber(doc, datos.logoAseguradoraBuffer)) ?? null;
    if (img) w.imagen(img, MARGIN_X, ALTO_LOGO);
  }
  if (datos.logoOltraBuffer) {
    const img = await intentarEmbeber(doc, datos.logoOltraBuffer);
    if (img) {
      const escala = ALTO_LOGO / img.height;
      const ancho = img.width * escala;
      w.imagen(img, MARGIN_X + CONTENT_WIDTH - ancho, ALTO_LOGO);
    }
  }
  if (datos.logoAseguradoraBuffer || datos.logoOltraBuffer) {
    w.espacio(ALTO_LOGO + PARAGRAPH_GAP);
  }

  w.linea([{ text: fechaLarga() }]);
  w.espacio();
  w.linea([{ text: "Sres." }]);
  w.lineaDual([{ text: datos.aseguradoraNombre }], [{ text: "Oltra Gestión Integral S.R.L" }]);
  w.espacio();
  w.linea([
    { text: "Ref.: ", bold: true },
    { text: "Autorización de retiro y traslado de vehículo siniestrado", bold: true, underline: true }
  ]);
  camposEnLinea(w, [
    ["Siniestro", datos.numeroSiniestro],
    ["Póliza", datos.numeroPoliza],
    ["Ítem", datos.itemPoliza]
  ]);
  w.parrafo("De nuestra consideración:");
  w.parrafo(
    "Por medio de la presente, quien suscribe, en su carácter de asegurado y/o titular registral del vehículo que se detalla a continuación, autoriza a esta Compañía, o a quien esta designe, a retirar y trasladar la unidad de su propiedad:"
  );
  camposEnLinea(w, [
    ["Marca", datos.vehiculoMarca],
    ["Modelo", datos.vehiculoModelo],
    ["Dominio", datos.vehiculoDominio]
  ]);
  w.parrafo("Ubicación actual de la unidad:");
  campo(w, "Domicilio", datos.aseguradoDireccion);
  campo(w, "Entre calles", datos.aseguradoEntreCalles);
  camposEnLinea(w, [
    ["Localidad", datos.aseguradoLocalidad],
    ["Partido", datos.aseguradoPartido],
    ["Provincia", datos.aseguradoProvincia]
  ]);
  campo(w, "Titular / contacto en el domicilio", datos.aseguradoNombre);
  campo(w, "Teléfono de contacto", datos.aseguradoTelefono);
  w.parrafo("Datos de quien hará entrega del vehículo:");
  campo(w, "Nombre y apellido", entregaNombre);
  campo(w, "DNI", entregaDni);
  campo(w, "Teléfono", entregaTelefono);
  if (hayTercero) {
    w.parrafo(
      `El Asegurado autoriza expresamente a ${datos.terceroNombre}${
        datos.terceroDni ? ` (DNI ${datos.terceroDni})` : ""
      } a hacer entrega de la unidad en su representación, con el mismo alcance que si la entrega fuera realizada por el propio Asegurado.`,
      { italic: true }
    );
  }
  w.lineaHorizontal();
  w.parrafo(
    "El Asegurado declara bajo juramento que, a la fecha de la presente, la unidad no registra embargo ni inhibición vigente sobre su titular. En caso de constatarse la existencia de alguna de estas situaciones con posterioridad al retiro, la Compañía procederá a restituir la unidad al Asegurado, quedando el costo del traslado correspondiente a cargo de este último."
  );
  w.parrafo(
    "Se deja constancia de que las multas y/o deudas que pesen sobre la unidad son, en todo momento, responsabilidad exclusiva del titular registral del vehículo."
  );
  w.parrafo(
    "Asimismo, el Asegurado se compromete a hacer entrega del vehículo en las mismas condiciones y estado en que fue constatado al momento de la inspección, es decir, sin alteraciones, modificaciones ni faltantes, incluyendo la totalidad de las llaves correspondientes a la unidad."
  );
  w.parrafo(
    "La presente autorización comprende tanto el retiro de la unidad desde el domicilio indicado como su traslado hasta el destino consignado, no siendo necesaria autorización adicional para esta última gestión.",
    { italic: true }
  );
  w.parrafo(
    "(*) La unidad deberá encontrarse disponible para su retiro dentro de los 20 (veinte) días corridos siguientes a la fecha de la presente autorización.",
    { italic: true }
  );
  w.parrafo("Sin otro particular, saluda a Uds. atentamente.");
  w.linea([
    {
      text: "Firma: ................................          Aclaración: ................................          DNI: ..................."
    }
  ]);

  return w.bytes();
}

// pdf-lib solo embebe jpg/png; devuelve null (en vez de romper la
// generación) si el logo cargado no es compatible.
async function intentarEmbeber(doc: PDFDocument, buffer: Buffer): Promise<PDFImage | null> {
  try {
    return await doc.embedJpg(buffer);
  } catch {
    try {
      return await doc.embedPng(buffer);
    } catch {
      return null;
    }
  }
}
