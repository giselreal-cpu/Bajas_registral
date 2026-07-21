import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

// Reusa el mismo factory que usan los catálogos: PUT valida los campos
// permitidos y actualiza. No exponemos DELETE acá (un vehículo con un caso
// asociado no debería poder borrarse desde esta pantalla).
export const { PUT } = createCatalogItemHandlers("vehiculos", [
  "dominio",
  "marca",
  "modelo",
  "anio",
  "chasis",
  "motor"
]);
