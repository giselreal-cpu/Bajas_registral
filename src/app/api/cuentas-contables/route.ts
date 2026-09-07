import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("cuentas_contables", "codigo", [
  "codigo",
  "nombre",
  "tipo",
  "imputable"
]);
