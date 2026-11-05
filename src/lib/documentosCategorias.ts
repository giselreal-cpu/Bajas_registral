// Categorías del módulo de Documentos del caso. Son solo tres; lo que cargan
// los gestores externos y el desarmadero (recibos, turnos, multas, patentes,
// etc.) y el Anexo 04 generado van dentro de "Documentación para la compañía".

import { NOMBRE_IPV, esBajaDigital } from "@/lib/tipoBaja";

export type CategoriaVisible = "imagen_dominio" | "documento_compania" | "formulario_baja";

export const CATEGORIAS_VISIBLES: { value: CategoriaVisible; label: string; labelCorto: string }[] = [
  { value: "imagen_dominio", label: "Imagen del dominio", labelCorto: "Imágenes del dominio" },
  { value: "documento_compania", label: "Documentación para la compañía", labelCorto: "Documentación para la Cía" },
  { value: "formulario_baja", label: "Formulario de baja", labelCorto: "Formulario de baja" }
];

// Las mismas categorías, con el formulario de baja rotulado según el tipo de
// baja: en "04 Digital" es el Instrumento de Petición Virtual (IPV).
export function categoriasPara(tipoBaja: string | null | undefined) {
  if (!esBajaDigital(tipoBaja)) return CATEGORIAS_VISIBLES;
  return CATEGORIAS_VISIBLES.map((c) =>
    c.value === "formulario_baja" ? { ...c, label: NOMBRE_IPV, labelCorto: "IPV" } : c
  );
}

// Categorías que existieron antes (cargas de gestor y desarmadero, Anexo 04):
// se muestran dentro de "Documentación para la compañía".
const CATEGORIAS_HEREDADAS = new Set([
  "turno_registro",
  "observaciones_gestor",
  "recibos_gestor",
  "otros_gestor",
  "multa_desarmadero",
  "patente_desarmadero",
  "otro_desarmadero",
  "anexo04_rudac"
]);

export function categoriaEfectiva(categoria: string): string {
  return CATEGORIAS_HEREDADAS.has(categoria) ? "documento_compania" : categoria;
}
