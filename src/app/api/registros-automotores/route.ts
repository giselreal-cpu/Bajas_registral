import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

export const { GET, POST } = createCatalogListHandlers(
  "registros_automotores",
  "numero",
  ["numero", "seccional", "provincia"]
);
