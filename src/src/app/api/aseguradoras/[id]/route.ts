import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("aseguradoras", [
  "nombre",
  "cuit",
  "contacto",
  "email",
  "telefono"
]);
