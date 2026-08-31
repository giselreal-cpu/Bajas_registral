import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("gestores", [
  "nombre",
  "contacto",
  "direccion",
  "email",
  "zona_cobertura"
]);
