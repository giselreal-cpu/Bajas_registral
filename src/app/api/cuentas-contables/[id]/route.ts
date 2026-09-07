import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("cuentas_contables", [
  "codigo",
  "codigo_padre",
  "nombre",
  "tipo",
  "imputable"
]);
