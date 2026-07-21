import { Document, Packer, Paragraph, TextRun, BorderStyle } from "docx";

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

  destinoNombre: string | null;
  destinoDireccion: string | null;
  destinoProvincia: string | null;

  terceroNombre: string | null;
  terceroDni: string | null;
  terceroContacto: string | null;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

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

// Autorización única que cubre tanto el retiro del vehículo (con las
// declaraciones legales sobre embargo/inhibición/multas y el estado de
// entrega) como el traslado en sí (origen, destino, provincias y datos de
// contacto para coordinarlo), para que alcance un solo documento firmado.
export async function generarAutorizacion(datos: DatosAutorizacion): Promise<Buffer> {
  const destino = [datos.destinoNombre, datos.destinoDireccion].filter(Boolean).join(" - ");
  const hayTercero = !!datos.terceroNombre;

  // Si se cargó un tercero autorizado, sus datos reemplazan a los del
  // asegurado en la sección de "quien hará entrega"; si no, es el propio
  // asegurado.
  const entregaNombre = hayTercero ? datos.terceroNombre : datos.aseguradoNombre;
  const entregaDni = hayTercero ? datos.terceroDni : datos.aseguradoDni;
  const entregaTelefono = hayTercero ? datos.terceroContacto : datos.aseguradoTelefono;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 650, bottom: 650, left: 1350, right: 1350 }
          }
        },
        children: [
          parrafo([texto(fechaLarga())]),
          parrafo([texto(" ")]),
          parrafo([texto("Sres.")]),
          parrafo([texto(datos.aseguradoraNombre)]),
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
              "Por medio de la presente, quien suscribe, en su carácter de asegurado y/o titular registral del vehículo que se detalla a continuación, autoriza a esa Compañía, o a quien esta designe, a retirar y trasladar la unidad de su propiedad:"
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
          parrafo([texto("Destino del traslado:")]),
          campo("Lugar", destino || null),
          campo("Provincia", datos.destinoProvincia),
          parrafo([
            texto("Persona autorizada a retirar y trasladar la unidad: ", { underline: {} }),
            texto(destino || "")
          ]),
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
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
}
