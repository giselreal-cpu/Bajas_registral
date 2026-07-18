import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("desarmaderos", [
  "nombre",
  "cuit",
  "contacto",
  "direccion",
  "provincia"
]);
