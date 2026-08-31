import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("gestores", "nombre", [
  "nombre",
  "contacto",
  "direccion",
  "email",
  "zona_cobertura"
]);
