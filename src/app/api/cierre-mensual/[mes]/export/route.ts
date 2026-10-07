import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { generarXlsxCierre, nombreArchivoCierre } from "@/lib/cierreExport";
import { armarContexto, resultadoParaExportar } from "@/lib/cierreMensualContexto";
import { obtenerDatosCierre } from "@/lib/cierreMensualDatos";

// GET /api/cierre-mensual/[mes]/export
// Excel con el libro completo: Resumen (fórmulas SUMIFS sobre el detalle) y
// una hoja por bloque (A, B, C, D, conciliación, transferencias,
// comparativo y rentabilidad). Un mes cerrado exporta el snapshot congelado.
export async function GET(request: NextRequest, { params }: { params: { mes: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }
  if (!/^\d{4}-\d{2}$/.test(params.mes)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }

  const supabase = createClient() as unknown as SupabaseClient;
  const datos = await obtenerDatosCierre(supabase);
  const { resultado, congelado } = await resultadoParaExportar(supabase, params.mes, datos);
  const ctx = await armarContexto(supabase, params.mes, resultado, datos, congelado, usuario.nombre);

  const buffer = await generarXlsxCierre(resultado, ctx);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivoCierre(params.mes, "xlsx")}"`
    }
  });
}
