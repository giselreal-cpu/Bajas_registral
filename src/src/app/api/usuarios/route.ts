import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers("usuarios", "nombre", [
  "nombre",
  "email",
  "auth_user_id"
]);
