import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("proveedores_reposicion", "nombre", [
  "nombre",
  "emails",
  "telefono"
]);
