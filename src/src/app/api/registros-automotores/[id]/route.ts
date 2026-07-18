import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("registros_automotores", [
  "numero",
  "seccional",
  "direccion"
]);
