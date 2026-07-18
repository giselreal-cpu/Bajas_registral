import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("aseguradoras", "nombre", [
  "nombre",
  "cuit",
  "contacto",
  "email",
  "telefono"
]);
