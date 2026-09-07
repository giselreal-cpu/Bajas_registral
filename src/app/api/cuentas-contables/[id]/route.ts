import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("cuentas_contables", [
  "codigo",
  "nombre",
  "tipo",
  "imputable"
]);
