import { createCatalogItemHandlers } from "@/lib/api/catalogHandlers";

// Igual que /api/vehiculos/[id]: reusa el factory de catálogos para poder
// editar los datos del asegurado después de creado el caso (antes solo se
// cargaban una vez, al alta, y no había forma de corregirlos después).
export const { PUT } = createCatalogItemHandlers("asegurados", [
  "nombre",
  "dni",
  "telefono",
  "email",
  "direccion",
  "localidad",
  "provincia",
  "entre_calles",
  "partido"
]);
