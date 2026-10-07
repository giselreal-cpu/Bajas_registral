import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarXlsxTabla, xlsxResponse } from "@/lib/xlsxTabla";

interface FacturaSeleccion {
  id: string;
  numero_factura: number;
  monto_total: number;
  caso: {
    valor_infoauto: number | null;
    tipo_baja: { nombre: string } | null;
    vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  } | null;
  cobros: { monto: number; anulado: boolean }[] | null;
  notas_credito: { monto: number; anulado: boolean }[] | null;
}

// GET /api/cuenta-corriente/export-seleccion?ids=<id1>,<id2>,...
// -> Excel de las facturas elegidas en pantalla (con saldo pendiente): tipo
// de baja, dominio, marca/modelo/año, Valor InfoAuto, % que representa lo facturado
// sobre el Valor InfoAuto, y saldo a cobrar.
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) {
    return new Response("Elegí al menos una factura.", { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(
      `
      id, numero_factura, monto_total,
      caso:casos(valor_infoauto, tipo_baja:tipos_baja(nombre), vehiculo:vehiculos(dominio, marca, modelo, anio)),
      cobros(monto, anulado),
      notas_credito(monto, anulado)
    `
    )
    .in("id", ids)
    .order("numero_factura");

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filas = ((data as unknown as FacturaSeleccion[] | null) ?? []).map((f) => {
    const cobrado =
      (f.cobros ?? []).filter((c) => !c.anulado).reduce((acc, c) => acc + Number(c.monto), 0) +
      (f.notas_credito ?? []).filter((n) => !n.anulado).reduce((acc, n) => acc + Number(n.monto), 0);
    const valorInfoauto = f.caso?.valor_infoauto != null ? Number(f.caso.valor_infoauto) : null;
    const porcentaje =
      valorInfoauto && valorInfoauto > 0
        ? Math.round((Number(f.monto_total) / valorInfoauto) * 10000) / 100
        : "";

    return {
      dominio: f.caso?.vehiculo?.dominio ?? "",
      tipo_baja: f.caso?.tipo_baja?.nombre ?? "",
      vehiculo: [f.caso?.vehiculo?.marca, f.caso?.vehiculo?.modelo, f.caso?.vehiculo?.anio]
        .filter(Boolean)
        .join(" "),
      valor_infoauto: valorInfoauto ?? "",
      porcentaje,
      saldo: Number(f.monto_total) - cobrado
    };
  });

  const buffer = await generarXlsxTabla(
    "Facturas a cobrar",
    [
      { key: "dominio", label: "Dominio", tipo: "texto", ancho: 11 },
      { key: "tipo_baja", label: "Tipo de Baja", ancho: 14 },
      { key: "vehiculo", label: "Marca/Modelo/Año", ancho: 34 },
      { key: "valor_infoauto", label: "Valor InfoAuto", tipo: "moneda" },
      { key: "porcentaje", label: "% sobre Valor InfoAuto", tipo: "porcentaje", ancho: 18 },
      { key: "saldo", label: "Saldo a Cobrar", tipo: "moneda" }
    ],
    filas
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `facturas_a_cobrar_${fecha}.xlsx`);
}
