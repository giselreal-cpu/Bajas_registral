import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { ESTADOS } from "@/types/database";
import { ETIQUETA_ESTADO_COBRO, obtenerCasos04cSinCobro } from "@/lib/seguimiento04c";
import { generarXlsxTabla, xlsxResponse } from "@/lib/xlsxTabla";

// GET /api/seguimiento-financiero/04c-sin-cobro-compania/export?aseguradora_id=
// -> Excel de los casos 04C con "Envío de documentación Cía" completado
// que todavía no se cobraron a la compañía, con el mismo filtro de
// compañía que la pantalla.
export async function GET(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (!usuarioActual || usuarioActual.rol === "compania") {
    return new Response("Sin acceso.", { status: 403 });
  }

  const aseguradoraId = request.nextUrl.searchParams.get("aseguradora_id") || null;
  const supabase = createClient() as unknown as SupabaseClient;

  let casos;
  try {
    casos = await obtenerCasos04cSinCobro(supabase, aseguradoraId);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudieron leer los casos.", { status: 500 });
  }

  const buffer = await generarXlsxTabla(
    "04C sin cobro a compañía",
    [
      { key: "aseguradora", label: "Compañía", ancho: 30 },
      { key: "numero_siniestro", label: "N° Siniestro", tipo: "texto", ancho: 18 },
      { key: "dominio", label: "Dominio", tipo: "texto", ancho: 11 },
      { key: "vehiculo", label: "Marca/Modelo/Año", ancho: 34 },
      { key: "estado", label: "Estado del caso", ancho: 24 },
      { key: "fecha_envio", label: "Envío de documentación", tipo: "fecha", ancho: 20 },
      { key: "dias", label: "Días desde el envío", tipo: "numero", ancho: 16 },
      { key: "estado_cobro", label: "Situación del cobro", ancho: 24 },
      { key: "importe", label: "A cobrar", tipo: "moneda" },
      { key: "cobrado", label: "Ya cobrado", tipo: "moneda" }
    ],
    casos.map((c) => ({
      aseguradora: c.aseguradora,
      numero_siniestro: c.numero_siniestro,
      dominio: c.dominio,
      vehiculo: c.vehiculo,
      estado: ESTADOS.find((e) => e.value === c.estado)?.label ?? c.estado,
      fecha_envio: c.fecha_envio,
      dias: c.dias_desde_envio,
      estado_cobro: ETIQUETA_ESTADO_COBRO[c.estado_cobro],
      importe: c.importe,
      cobrado: c.cobrado
    }))
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `04c_sin_cobro_compania_${fecha}.xlsx`);
}
