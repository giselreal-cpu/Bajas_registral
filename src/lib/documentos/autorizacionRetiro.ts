import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  WidthType,
  VerticalAlign,
  AlignmentType
} from "docx";
import { imageSize } from "image-size";

export interface DatosAutorizacion {
  aseguradoraNombre: string;
  numeroSiniestro: string;
  numeroPoliza: string | null;
  itemPoliza: string | null;

  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoDominio: string;

  aseguradoNombre: string;
  aseguradoDni: string | null;
  aseguradoDireccion: string | null;
  aseguradoEntreCalles: string | null;
  aseguradoLocalidad: string | null;
  aseguradoPartido: string | null;
  aseguradoProvincia: string | null;
  aseguradoTelefono: string | null;

  terceroNombre: string | null;
  terceroDni: string | null;
  terceroContacto: string | null;

  // Logo de la aseguradora (null si todavía no cargó uno) y de Oltra —
  // se muestran lado a lado en el encabezado del documento.
  logoAseguradoraBuffer: Buffer | null;
  logoOltraBuffer: Buffer | null;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

// Ancho de página (A4 estándar de docx-js) menos los márgenes izq/der
// definidos más abajo, en DXA (1440 = 1 pulgada).
const ANCHO_CONTENIDO_DXA = 12240 - 1350 - 1350;
const ALTO_LOGO_PX = 55;

function fechaLarga(): string {
  const hoy = new Date();
  return `Buenos Aires, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
}

function parrafo(children: TextRun[], opciones: Record<string, any> = {}) {
  return new Paragraph({ spacing: { after: 90 }, ...opciones, children });
}

function texto(text: string, opciones: Record<string, any> = {}) {
  return new TextRun({ text, ...opciones });
}

function campo(etiqueta: string, valor: string | null) {
  return parrafo([texto(`${etiqueta}: `, { bold: true }), texto(valor ?? "")]);
}

function camposEnLinea(pares: [string, string | null][]) {
  const children: TextRun[] = [];
  pares.forEach(([etiqueta, valor], i) => {
    if (i > 0) children.push(texto("     "));
    children.push(texto(`${etiqueta}: `, { bold: true }), texto(valor ?? ""));
  });
  return parrafo(children);
}

// docx-js solo sabe embeber jpg/png/gif/bmp (ver RegularImageOptions);
// subirLogoAseguradora ya restringe la carga a jpg/png, así que esto
// nunca debería toparse con otro formato.
function tipoImagen(buffer: Buffer): "jpg" | "png" {
  const dims = imageSize(buffer);
  return dims.type === "png" ? "png" : "jpg";
}

function logoParagraph(buffer: Buffer | null, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) {
  if (!buffer) return new Paragraph({});
  const dims = imageSize(buffer);
  const height = ALTO_LOGO_PX;
  const width = Math.round(((dims.width ?? 1) / (dims.height ?? 1)) * height);
  return new Paragraph({
    alignment,
    children: [
      new ImageRun({
        type: tipoImagen(buffer),
        data: buffer,
        transformation: { width, height }
      })
    ]
  });
}

// Tabla de 2 columnas sin bordes — se usa tanto para el encabezado con
// los logos como para la línea "Aseguradora / Oltra" que sigue al
// "Sres." (mismo layout que el documento de referencia del usuario).
function filaDosColumnas(izquierda: Paragraph, derecha: Paragraph) {
  const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bordesCelda = { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde };
  const anchoColumna = ANCHO_CONTENIDO_DXA / 2;
  return new Table({
    width: { size: ANCHO_CONTENIDO_DXA, type: WidthType.DXA },
    columnWidths: [anchoColumna, anchoColumna],
    borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde, insideHorizontal: sinBorde, insideVertical: sinBorde },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: anchoColumna, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: bordesCelda,
            children: [izquierda]
          }),
          new TableCell({
            width: { size: anchoColumna, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: bordesCelda,
            children: [derecha]
          })
        ]
      })
    ]
  });
}

// Autorización de retiro y traslado de vehículo siniestrado, con el
// encabezado de logos (aseguradora + Oltra) y el texto acordado con el
// usuario a partir del documento real que usan hoy.
export async function generarAutorizacion(datos: DatosAutorizacion): Promise<Buffer> {
  const hayTercero = !!datos.terceroNombre;

  // Si se cargó un tercero autorizado, sus datos reemplazan a los del
  // asegurado en la sección de "quien hará entrega"; si no, es el propio
  // asegurado.
  const entregaNombre = hayTercero ? datos.terceroNombre : datos.aseguradoNombre;
  const entregaDni = hayTercero ? datos.terceroDni : datos.aseguradoDni;
  const entregaTelefono = hayTercero ? datos.terceroContacto : datos.aseguradoTelefono;

  const children: (Paragraph | Table)[] = [];

  if (datos.logoAseguradoraBuffer || datos.logoOltraBuffer) {
    children.push(
      filaDosColumnas(
        logoParagraph(datos.logoAseguradoraBuffer, AlignmentType.LEFT),
        logoParagraph(datos.logoOltraBuffer, AlignmentType.RIGHT)
      ),
      parrafo([texto(" ")])
    );
  }

  children.push(
    parrafo([texto(fechaLarga())]),
    parrafo([texto(" ")]),
    parrafo([texto("Sres.")]),
    filaDosColumnas(
      parrafo([texto(datos.aseguradoraNombre)]),
      parrafo([texto("Oltra Gestión Integral S.R.L")], { alignment: AlignmentType.RIGHT })
    ),
    parrafo([texto(" ")]),
    parrafo([
      texto("Ref.: ", { bold: true }),
      texto("Autorización de retiro y traslado de vehículo siniestrado", {
        bold: true,
        underline: {}
      })
    ]),
    camposEnLinea([
      ["Siniestro", datos.numeroSiniestro],
      ["Póliza", datos.numeroPoliza],
      ["Ítem", datos.itemPoliza]
    ]),
    parrafo([texto("De nuestra consideración:")]),
    parrafo([
      texto(
        "Por medio de la presente, quien suscribe, en su carácter de asegurado y/o titular registral del vehículo que se detalla a continuación, autoriza a esta Compañía, o a quien esta designe, a retirar y trasladar la unidad de su propiedad:"
      )
    ]),
    camposEnLinea([
      ["Marca", datos.vehiculoMarca],
      ["Modelo", datos.vehiculoModelo],
      ["Dominio", datos.vehiculoDominio]
    ]),
    parrafo([texto("Ubicación actual de la unidad:")]),
    campo("Domicilio", datos.aseguradoDireccion),
    campo("Entre calles", datos.aseguradoEntreCalles),
    camposEnLinea([
      ["Localidad", datos.aseguradoLocalidad],
      ["Partido", datos.aseguradoPartido],
      ["Provincia", datos.aseguradoProvincia]
    ]),
    campo("Titular / contacto en el domicilio", datos.aseguradoNombre),
    campo("Teléfono de contacto", datos.aseguradoTelefono),
    parrafo([texto("Datos de quien hará entrega del vehículo:")]),
    campo("Nombre y apellido", entregaNombre),
    campo("DNI", entregaDni),
    campo("Teléfono", entregaTelefono),
    ...(hayTercero
      ? [
          parrafo([
            texto(
              `El Asegurado autoriza expresamente a ${datos.terceroNombre}${
                datos.terceroDni ? ` (DNI ${datos.terceroDni})` : ""
              } a hacer entrega de la unidad en su representación, con el mismo alcance que si la entrega fuera realizada por el propio Asegurado.`,
              { italics: true }
            )
          ])
        ]
      : []),
    parrafo([texto(" ")], {
      border: {
        bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 }
      }
    }),
    parrafo([
      texto(
        "El Asegurado declara bajo juramento que, a la fecha de la presente, la unidad no registra embargo ni inhibición vigente sobre su titular. En caso de constatarse la existencia de alguna de estas situaciones con posterioridad al retiro, la Compañía procederá a restituir la unidad al Asegurado, quedando el costo del traslado correspondiente a cargo de este último."
      )
    ]),
    parrafo([
      texto(
        "Se deja constancia de que las multas y/o deudas que pesen sobre la unidad son, en todo momento, responsabilidad exclusiva del titular registral del vehículo."
      )
    ]),
    parrafo([
      texto(
        "Asimismo, el Asegurado se compromete a hacer entrega del vehículo en las mismas condiciones y estado en que fue constatado al momento de la inspección, es decir, sin alteraciones, modificaciones ni faltantes, incluyendo la totalidad de las llaves correspondientes a la unidad."
      )
    ]),
    parrafo([
      texto(
        "La presente autorización comprende tanto el retiro de la unidad desde el domicilio indicado como su traslado hasta el destino consignado, no siendo necesaria autorización adicional para esta última gestión.",
        { italics: true }
      )
    ]),
    parrafo([
      texto(
        "(*) La unidad deberá encontrarse disponible para su retiro dentro de los 20 (veinte) días corridos siguientes a la fecha de la presente autorización.",
        { italics: true }
      )
    ]),
    parrafo([texto("Sin otro particular, saluda a Uds. atentamente.")]),
    parrafo([
      texto(
        "Firma: ................................          Aclaración: ................................          DNI: ..................."
      )
    ])
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 650, bottom: 650, left: 1350, right: 1350 }
          }
        },
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}
