import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("gestores", "nombre", [
  "nombre",
  "contacto"
]);
