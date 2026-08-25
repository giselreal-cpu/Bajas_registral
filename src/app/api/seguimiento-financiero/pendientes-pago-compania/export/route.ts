import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

const PAGO_COMPANIA = "Pago a la compañía";

interface CasoCerradoExport {
  numero_siniestro: string;
  fecha_cierre: string | null;
  tramitador_nombre: string | null;
  aseguradora: { nombre: string } | null;
  desarmadero: { nombre: string } | null;
  vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  movimientos_caso: { monto: number; pagado: boolean; concepto: { nombre: string } | null }[];
}

// GET /api/seguimiento-financiero/pendientes-pago-compania/export -> CSV de
// casos cerrados a los que todavía no se les pagó a la compañía (sea
// porque no se cargó el movimiento, o se cargó sin marcar "pagado").
export async function GET() {
  const supabase = createClient();

  const { data: casos, error } = await supabase
    .from("casos")
    .select(
      `
      numero_siniestro, fecha_cierre, tramitador_nombre,
      aseguradora:aseguradoras(nombre),
      desarmadero:desarmaderos(nombre),
      vehiculo:vehiculos(dominio, marca, modelo, anio),
      movimientos_caso(monto, pagado, concepto:conceptos_movimiento(nombre))
    `
    )
    .eq("estado", "cerrado")
    .order("fecha_cierre", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filas = ((casos as unknown as CasoCerradoExport[] | null) ?? [])
    .map((c) => ({
      ...c,
      movPago: c.movimientos_caso.find((m) => m.concepto?.nombre === PAGO_COMPANIA) ?? null
    }))
    .filter((c) => !c.movPago || !c.movPago.pagado)
    .map((c) => ({
      numero_siniestro: c.numero_siniestro,
      compania: c.aseguradora?.nombre ?? "",
      dominio: c.vehiculo?.dominio ?? "",
      vehiculo: [c.vehiculo?.marca, c.vehiculo?.modelo, c.vehiculo?.anio].filter(Boolean).join(" "),
      desarmadero: c.desarmadero?.nombre ?? "",
      tramitador: c.tramitador_nombre ?? "",
      valor_restos: c.movPago ? c.movPago.monto : "",
      estado_pago: c.movPago ? "Cargado, sin marcar pagado" : "Sin cargar",
      fecha_cierre: c.fecha_cierre ?? ""
    }));

  const csv = toCsv(filas, [
    { key: "numero_siniestro", label: "N° Siniestro" },
    { key: "compania", label: "Compañía" },
    { key: "dominio", label: "Dominio" },
    { key: "vehiculo", label: "Marca/Modelo/Año" },
    { key: "desarmadero", label: "Desarmadero" },
    { key: "tramitador", label: "Tramitador" },
    { key: "valor_restos", label: "Valor restos (pago a compañía)" },
    { key: "estado_pago", label: "Estado del pago" },
    { key: "fecha_cierre", label: "Fecha de Cierre" }
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `pendientes_pago_compania_${fecha}.csv`);
}
