import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/presupuestos/real?mes=AAAA-MM -> lo efectivamente cargado
// ese mes por cuenta contable (devengado, aprobado, no anulado, solo
// ARS) — mismo criterio que "Resumen por cuenta", acotado a un mes
// puntual, para comparar contra el presupuesto de ese mes.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mes = searchParams.get("mes");
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "Falta un mes válido (AAAA-MM)." }, { status: 400 });
  }

  const supabase = createClient();
  const desde = `${mes}-01`;
  const [anio, mesNum] = mes.split("-").map(Number);
  const hasta = new Date(anio, mesNum, 1).toISOString().slice(0, 10);

  const [{ data: movCuentas }, { data: genCuentas }] = await Promise.all([
    supabase
      .from("movimientos_caso")
      .select("cuenta_contable_id, monto, moneda")
      .eq("aprobado", true)
      .eq("anulado", false)
      .eq("moneda", "ARS")
      .not("cuenta_contable_id", "is", null)
      .gte("fecha", desde)
      .lt("fecha", hasta),
    supabase
      .from("movimientos_generales")
      .select("cuenta_contable_id, monto, moneda")
      .eq("anulado", false)
      .eq("moneda", "ARS")
      .not("cuenta_contable_id", "is", null)
      .gte("fecha", desde)
      .lt("fecha", hasta)
  ]);

  const real: Record<string, number> = {};
  for (const m of [...(movCuentas ?? []), ...(genCuentas ?? [])] as {
    cuenta_contable_id: string;
    monto: number;
  }[]) {
    real[m.cuenta_contable_id] = (real[m.cuenta_contable_id] ?? 0) + Number(m.monto);
  }

  return NextResponse.json({ data: real });
}
