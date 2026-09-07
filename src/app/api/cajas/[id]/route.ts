import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("cajas", [
  "nombre",
  "tipo",
  "moneda",
  "saldo_inicial",
  "activa"
]);
