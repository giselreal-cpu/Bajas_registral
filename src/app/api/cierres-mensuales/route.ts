import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/cierres-mensuales -> meses cerrados, más recientes primero.
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_mensuales")
    .select("*, cerrado_por_usuario:usuarios(nombre)")
    .order("mes", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// El cierre ahora se hace desde Administración > Cierre mensual
// (POST /api/cierre-mensual/[mes]/cerrar): exige el saldo real de cada
// caja y congela un snapshot. Este endpoint ya no cierra períodos para
// que nadie quede con un mes cerrado sin snapshot.
export async function POST() {
  return NextResponse.json(
    { error: "El cierre se hace desde Administración > Cierre mensual." },
    { status: 410 }
  );
}
