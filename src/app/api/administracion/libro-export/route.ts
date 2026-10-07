import { NextRequest } from "next/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { obtenerFilasLibro } from "@/lib/libroMovimientos";
import { generarXlsxTabla, xlsxResponse } from "@/lib/xlsxTabla";

// GET /api/administracion/libro-export?caja_id=&cuenta_contable_id=&aseguradora_id=&desde=&hasta=
// -> Excel del Libro de movimientos con los mismos filtros y el mismo
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
    hasta: searchParams.get("hasta") ?? undefined,
    orden: searchParams.get("orden") ?? undefined
  };

  const { filas } = await obtenerFilasLibro(filtros);

  const buffer = await generarXlsxTabla(
    "Libro de movimientos",
    [
      { key: "fecha", label: "Fecha", tipo: "fecha" },
      { key: "caso", label: "Caso", tipo: "texto", ancho: 30 },
      { key: "descripcion", label: "Descripción", ancho: 45 },
      { key: "cuenta", label: "Cuenta contable", tipo: "texto", ancho: 16 },
      { key: "caja", label: "Caja", ancho: 20 },
      { key: "centro_de_costo", label: "Centro de costo", ancho: 22 },
      { key: "tipo", label: "Tipo", ancho: 12 },
      { key: "importe", label: "Importe", tipo: "moneda" },
      { key: "saldo", label: "Saldo", tipo: "moneda" }
    ],
    filas.map(({ f, importe, saldo }) => ({
      fecha: f.fecha,
      caso: f.casoLabel ?? "",
      descripcion: f.descripcion,
      cuenta: f.cuentaCodigo ?? "",
      caja: f.cajaNombre ?? "Sin asignar",
      centro_de_costo: f.centroDeCosto,
      tipo: f.tipo,
      importe,
      saldo
    }))
  );

  return xlsxResponse(buffer, `libro-de-movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
