import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("documentos", [
  "categoria",
  "nombre",
  "url"
]);
