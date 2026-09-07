import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("cuentas_contables", "codigo", [
  "codigo",
  "codigo_padre",
  "nombre",
  "tipo",
  "imputable"
]);
