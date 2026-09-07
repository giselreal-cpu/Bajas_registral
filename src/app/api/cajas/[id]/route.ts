import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("cajas", [
  "nombre",
  "tipo",
  "saldo_inicial",
  "activa"
]);
