import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { ESTADOS } from "@/types/database";
import { obtenerBajasPagadasSinFactura } from "@/lib/seguimientoFacturaCompania";
import { generarXlsxTabla, xlsxResponse } from "@/lib/xlsxTabla";

// GET /api/seguimiento-financiero/bajas-pagadas-sin-factura/export?aseguradora_id=
// -> Excel de las bajas pagadas a la compañía sin factura recibida, con el
// mismo filtro de compañía que la pantalla.
export async function GET(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (!usuarioActual || usuarioActual.rol === "compania") {
    return new Response("Sin acceso.", { status: 403 });
  }

  const aseguradoraId = request.nextUrl.searchParams.get("aseguradora_id") || null;
  const supabase = createClient() as unknown as SupabaseClient;

  let bajas;
  try {
    bajas = await obtenerBajasPagadasSinFactura(supabase, aseguradoraId);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudieron leer los datos.", { status: 500 });
  }

  const buffer = await generarXlsxTabla(
    "Pagadas sin factura",
    [
      { key: "aseguradora", label: "Compañía", ancho: 30 },
      { key: "numero_siniestro", label: "N° Siniestro", tipo: "texto", ancho: 18 },
      { key: "dominio", label: "Dominio", tipo: "texto", ancho: 11 },
      { key: "tipo_baja", label: "Tipo de baja", ancho: 14 },
      { key: "estado", label: "Estado del caso", ancho: 24 },
      { key: "fecha_pago", label: "Fecha de pago", tipo: "fecha" },
      { key: "dias", label: "Días desde el pago", tipo: "numero", ancho: 16 },
      { key: "monto", label: "Monto pagado", tipo: "moneda" }
    ],
    bajas.map((b) => ({
      aseguradora: b.aseguradora,
      numero_siniestro: b.numero_siniestro,
      dominio: b.dominio,
      tipo_baja: b.tipo_baja,
      estado: ESTADOS.find((e) => e.value === b.estado)?.label ?? b.estado,
      fecha_pago: b.fecha_pago,
      dias: b.dias_desde_pago,
      monto: b.monto
    }))
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `bajas_pagadas_sin_factura_${fecha}.xlsx`);
}
