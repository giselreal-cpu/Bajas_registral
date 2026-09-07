import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("cajas", "nombre", [
  "nombre",
  "tipo",
  "moneda",
  "saldo_inicial",
  "activa"
]);
