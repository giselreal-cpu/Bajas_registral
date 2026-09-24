import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

export const { PUT, DELETE } = createCatalogItemHandlers("tramitadores", ["nombre", "email"]);
