import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("tipos_baja", "nombre", [
  "nombre",
  "descripcion"
]);
