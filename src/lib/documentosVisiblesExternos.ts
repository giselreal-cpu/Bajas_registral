// Documentación del caso que se le muestra a quien recibe un enlace público
// para completar la baja (desarmadero y persona del Formulario de Baja):
// Título, Cédulas, Foto del titular, DNI, Estatuto, Poder, Extravío (denuncia),
// Informe de dominio y Fotos. Multas, patentes, autorizaciones y el resto de la
// documentación de la compañía no se muestran.
//
// Los documentos se reconocen por el nombre con el que el equipo los carga
// ("Título", "Cédula", "Informe de dominio", "Foto titular"), salvo las Fotos,
// que tienen su propia categoría fija (imagen_dominio).

export interface DocumentoBase {
  nombre: string;
  categoria: string;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const FOTO_TITULAR = /foto(s)?\s+(del\s+)?titul/;
const TITULO = /\btitulo\b/;
const DNI = /\bdni\b/;
const PODER = /\bpoder(es)?\b/;

export function esFotoTitular(nombre: string): boolean {
  return FOTO_TITULAR.test(normalizar(nombre));
}

// Foto del cónyuge: el nombre tiene "cony…" (cónyuge, conyugue, cony.) o
// esposo/a, junto con "foto" o cargado en la categoría de imágenes.
export function esFotoConyuge(doc: DocumentoBase): boolean {
  const n = normalizar(doc.nombre);
  return /cony|espos[oa]/.test(n) && (n.includes("foto") || doc.categoria === "imagen_dominio");
}

// Instrumento de Petición Virtual: "IPV", "instrumento…" o "petición…" (salvo
// las peticiones de informes).
export function esIpv(nombre: string): boolean {
  const n = normalizar(nombre);
  return /\bipv\b|instrumento/.test(n) || (n.includes("peticion") && !n.includes("informe"));
}

// `digital`: baja tipo 04 Digital. Solo ahí se separan la foto del cónyuge y
// el IPV; en el resto de los tipos de baja se comportan como antes (la foto
// del cónyuge queda dentro de Fotos y el IPV no se comparte).
export function clasificarDocumentosVisibles<T extends DocumentoBase>(docs: T[], opciones: { digital?: boolean } = {}) {
  const digital = !!opciones.digital;
  const por = (test: (n: string) => boolean) => docs.filter((d) => test(normalizar(d.nombre)));
  return {
    titulo: por((n) => TITULO.test(n)),
    cedulas: por((n) => n.includes("cedula")),
    fotoTitular: docs.filter((d) => esFotoTitular(d.nombre)),
    fotoConyuge: digital ? docs.filter((d) => esFotoConyuge(d)) : [],
    // Instrumento de Petición Virtual (04 Digital): se carga en la
    // documentación para la compañía cuando está listo para RUDAC.
    ipv: digital ? docs.filter((d) => esIpv(d.nombre)) : [],
    dni: por((n) => DNI.test(n)),
    estatuto: por((n) => n.includes("estatuto")),
    poder: por((n) => PODER.test(n)),
    extravio: por((n) => n.includes("extrav")),
    informeDominio: por((n) => n.includes("informe de dominio")),
    fotos: docs.filter(
      (d) => d.categoria === "imagen_dominio" && !esFotoTitular(d.nombre) && !(digital && esFotoConyuge(d))
    )
  };
}

export type ClaveGrupoVisible = keyof ReturnType<typeof clasificarDocumentosVisibles>;

export const GRUPOS_VISIBLES_EXTERNOS: { clave: ClaveGrupoVisible; titulo: string }[] = [
  { clave: "titulo", titulo: "Título" },
  { clave: "cedulas", titulo: "Cédulas" },
  { clave: "fotoTitular", titulo: "Foto del titular" },
  { clave: "dni", titulo: "DNI" },
  { clave: "estatuto", titulo: "Estatuto" },
  { clave: "poder", titulo: "Poder" },
  { clave: "extravio", titulo: "Extravío (denuncia)" },
  { clave: "informeDominio", titulo: "Informe de dominio" },
  { clave: "fotos", titulo: "Fotos" }
];

// Lo que ve el desarmadero (enlace /d): lo anterior más la foto del cónyuge y
// el IPV listo para cargar en RUDAC. El enlace del Formulario de Baja (/fb)
// sigue usando solo GRUPOS_VISIBLES_EXTERNOS.
export const GRUPOS_VISIBLES_DESARMADERO: { clave: ClaveGrupoVisible; titulo: string }[] = [
  { clave: "titulo", titulo: "Título" },
  { clave: "cedulas", titulo: "Cédulas" },
  { clave: "fotoTitular", titulo: "Foto del titular" },
  { clave: "fotoConyuge", titulo: "Foto del cónyuge" },
  { clave: "dni", titulo: "DNI" },
  { clave: "estatuto", titulo: "Estatuto" },
  { clave: "poder", titulo: "Poder" },
  { clave: "extravio", titulo: "Extravío (denuncia)" },
  { clave: "informeDominio", titulo: "Informe de dominio" },
  { clave: "ipv", titulo: "Instrumento de Petición Virtual (IPV)" },
  { clave: "fotos", titulo: "Fotos" }
];
