import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("tipos_baja", [
  "nombre",
  "descripcion"
]);
