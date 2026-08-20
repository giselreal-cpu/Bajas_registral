import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("conceptos_movimiento", "nombre", [
  "nombre",
  "tipo"
]);
