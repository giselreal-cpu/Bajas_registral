import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("cajas", "nombre", [
  "nombre",
  "tipo",
  "saldo_inicial",
  "activa"
]);
