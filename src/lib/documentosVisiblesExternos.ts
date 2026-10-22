// Documentación del caso que se le muestra a quien recibe un enlace público
// para completar la baja (desarmadero y persona del Formulario de Baja):
// solo Título, Cédulas, Informe de dominio, Foto del titular y Fotos.
// Multas, patentes, autorizaciones, documentación de la compañía y Anexo 04
// no se muestran.
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

const FOTO_TITULAR = /foto(s)?\s+(del\s+)?titular/;
const TITULO = /\btitulo\b/;

export function esFotoTitular(nombre: string): boolean {
  return FOTO_TITULAR.test(normalizar(nombre));
}

export function clasificarDocumentosVisibles<T extends DocumentoBase>(docs: T[]) {
  return {
    titulo: docs.filter((d) => TITULO.test(normalizar(d.nombre))),
    cedulas: docs.filter((d) => normalizar(d.nombre).includes("cedula")),
    informeDominio: docs.filter((d) => normalizar(d.nombre).includes("informe de dominio")),
    fotoTitular: docs.filter((d) => esFotoTitular(d.nombre)),
    fotos: docs.filter((d) => d.categoria === "imagen_dominio" && !esFotoTitular(d.nombre))
  };
}

export const GRUPOS_VISIBLES_EXTERNOS: { clave: "titulo" | "cedulas" | "informeDominio" | "fotoTitular" | "fotos"; titulo: string }[] = [
  { clave: "titulo", titulo: "Título" },
  { clave: "cedulas", titulo: "Cédulas" },
  { clave: "informeDominio", titulo: "Informe de dominio" },
  { clave: "fotoTitular", titulo: "Foto del titular" },
  { clave: "fotos", titulo: "Fotos" }
];
