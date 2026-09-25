import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("tramitadores", "nombre", [
  "nombre",
  "email",
  "aseguradora_id"
]);
