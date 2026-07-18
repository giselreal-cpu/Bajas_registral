import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("desarmaderos", "nombre", [
  "nombre",
  "cuit",
  "contacto",
  "direccion"
]);
