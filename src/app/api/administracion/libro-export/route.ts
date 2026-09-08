import { NextRequest } from "next/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { obtenerFilasLibro } from "@/lib/libroMovimientos";
import { toCsv, csvResponse } from "@/lib/csv";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// GET /api/administracion/libro-export?caja_id=&cuenta_contable_id=&aseguradora_id=&desde=&hasta=
// -> CSV del Libro de movimientos con los mismos filtros y el mismo
// criterio (solo lo pagado/cobrado) que la vista en pantalla.
export async function GET(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return new Response("Sin acceso.", { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const filtros = {
    caja_id: searchParams.get("caja_id") ?? undefined,
    cuenta_contable_id: searchParams.get("cuenta_contable_id") ?? undefined,
    aseguradora_id: searchParams.get("aseguradora_id") ?? undefined,
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined
  };

  const { filas } = await obtenerFilasLibro(filtros);

  const csv = toCsv(
    filas.map(({ f, importe, saldo }) => ({
      fecha: f.fecha,
      caso: f.casoLabel ?? "",
      descripcion: f.descripcion,
      cuenta: f.cuentaCodigo ?? "",
      caja: f.cajaNombre ?? "Sin asignar",
      centro_de_costo: f.centroDeCosto,
      tipo: f.tipo,
      importe: formatCurrency(importe),
      saldo: formatCurrency(saldo)
    })),
    [
      { key: "fecha", label: "Fecha" },
      { key: "caso", label: "Caso" },
      { key: "descripcion", label: "Descripción" },
      { key: "cuenta", label: "Cuenta contable" },
      { key: "caja", label: "Caja" },
      { key: "centro_de_costo", label: "Centro de costo" },
      { key: "tipo", label: "Tipo" },
      { key: "importe", label: "Importe" },
      { key: "saldo", label: "Saldo" }
    ]
  );

  return csvResponse(csv, `libro-de-movimientos-${new Date().toISOString().slice(0, 10)}.csv`);
}
