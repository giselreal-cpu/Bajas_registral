import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { toCsv, csvResponse } from "@/lib/csv";
import { BloqueCsv, datosCsvBloque, generarXlsxCierre, nombreArchivoCierre } from "@/lib/cierreExport";
import { armarContexto, resultadoParaExportar } from "@/lib/cierreMensualContexto";
import { obtenerDatosCierre } from "@/lib/cierreMensualDatos";

const BLOQUES: BloqueCsv[] = ["A", "B", "C", "D", "conciliacion", "transferencias", "comparativo", "rentabilidad"];

// GET /api/cierre-mensual/[mes]/export?formato=xlsx|csv&bloque=...
// xlsx: libro completo con Resumen (fórmulas SUMIFS sobre el detalle).
// csv: un bloque (A, B, C, D, conciliacion, transferencias, comparativo,
// rentabilidad). Un mes cerrado exporta el snapshot congelado.
export async function GET(request: NextRequest, { params }: { params: { mes: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }
  if (!/^\d{4}-\d{2}$/.test(params.mes)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }

  const formato = request.nextUrl.searchParams.get("formato") === "csv" ? "csv" : "xlsx";
  const supabase = createClient() as unknown as SupabaseClient;
  const datos = await obtenerDatosCierre(supabase);
  const { resultado, congelado } = await resultadoParaExportar(supabase, params.mes, datos);
  const ctx = await armarContexto(supabase, params.mes, resultado, datos, congelado, usuario.nombre);

  if (formato === "csv") {
    const bloque = request.nextUrl.searchParams.get("bloque") as BloqueCsv;
    if (!BLOQUES.includes(bloque)) {
      return NextResponse.json({ error: "Elegí un bloque válido para el CSV." }, { status: 400 });
    }
    const { rows, columns } = datosCsvBloque(bloque, resultado, ctx);
    return csvResponse(toCsv(rows, columns), nombreArchivoCierre(params.mes, "csv", bloque));
  }

  const buffer = await generarXlsxCierre(resultado, ctx);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivoCierre(params.mes, "xlsx")}"`
    }
  });
}
