import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("proveedores_reposicion", [
  "nombre",
  "emails",
  "telefono"
]);
