import { NextRequest } from "next/server";
import { createCatalogListHandlers } from "@/lib/api/catalogHandlers";

const handlers = createCatalogListHandlers("desarmaderos", "nombre", [
  "nombre",
  "cuit",
  "contacto",
  "direccion",
  "provincia",
  "estado"
]);

export const GET = handlers.GET;

// Un desarmadero nuevo queda "activo" si el formulario no manda el estado
// (el catálogo genérico convertiría el vacío en null).
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.estado) delete body.estado;
  return handlers.POST(
    new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(body)
    })
  );
}
