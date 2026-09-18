import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

interface FacturaSeleccion {
  id: string;
  numero_factura: number;
  monto_total: number;
  caso: {
    valor_infoauto: number | null;
    tipo_baja: { nombre: string } | null;
    vehiculo: { marca: string | null; modelo: string | null; anio: number | null } | null;
  } | null;
  cobros: { monto: number; anulado: boolean }[] | null;
  notas_credito: { monto: number; anulado: boolean }[] | null;
}

// GET /api/cuenta-corriente/export-seleccion?ids=<id1>,<id2>,...
// -> CSV de las facturas elegidas en pantalla (con saldo pendiente): tipo
// de baja, marca/modelo/año, Valor InfoAuto, % que representa lo facturado
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
      caso:casos(valor_infoauto, tipo_baja:tipos_baja(nombre), vehiculo:vehiculos(marca, modelo, anio)),
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
      tipo_baja: f.caso?.tipo_baja?.nombre ?? "",
      vehiculo: [f.caso?.vehiculo?.marca, f.caso?.vehiculo?.modelo, f.caso?.vehiculo?.anio]
        .filter(Boolean)
        .join(" "),
      valor_infoauto: valorInfoauto ?? "",
      porcentaje,
      saldo: Number(f.monto_total) - cobrado
    };
  });

  const csv = toCsv(filas, [
    { key: "tipo_baja", label: "Tipo de Baja" },
    { key: "vehiculo", label: "Marca/Modelo/Año" },
    { key: "valor_infoauto", label: "Valor InfoAuto" },
    { key: "porcentaje", label: "% sobre Valor InfoAuto" },
    { key: "saldo", label: "Saldo a Cobrar" }
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `facturas_a_cobrar_${fecha}.csv`);
}
