import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("conceptos_movimiento", [
  "nombre",
  "tipo"
]);
