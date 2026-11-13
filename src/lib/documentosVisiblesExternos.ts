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

export function clasificarDocumentosVisibles<T extends DocumentoBase>(docs: T[]) {
  const por = (test: (n: string) => boolean) => docs.filter((d) => test(normalizar(d.nombre)));
  return {
    titulo: por((n) => TITULO.test(n)),
    cedulas: por((n) => n.includes("cedula")),
    fotoTitular: docs.filter((d) => esFotoTitular(d.nombre)),
    dni: por((n) => DNI.test(n)),
    estatuto: por((n) => n.includes("estatuto")),
    poder: por((n) => PODER.test(n)),
    extravio: por((n) => n.includes("extrav")),
    informeDominio: por((n) => n.includes("informe de dominio")),
    fotos: docs.filter((d) => d.categoria === "imagen_dominio" && !esFotoTitular(d.nombre))
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
