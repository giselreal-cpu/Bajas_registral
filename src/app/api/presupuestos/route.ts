import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual, getUsuarioActualId } from "@/lib/auth/usuarioActual";

// GET /api/presupuestos?mes=AAAA-MM -> presupuestos cargados para ese mes.
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const mes = searchParams.get("mes");
  if (!mes) {
    return NextResponse.json({ error: "Falta el mes (AAAA-MM)." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("presupuestos")
    .select("*, cuenta_contable:cuentas_contables(*)")
    .eq("mes", mes);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/presupuestos -> carga o actualiza el presupuesto de una
// cuenta para un mes (upsert por cuenta+mes). Reservado a administrador.
export async function POST(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede cargar un presupuesto." }, { status: 403 });
  }

  const body = await request.json();
  const { cuenta_contable_id, mes, monto } = body;

  if (!cuenta_contable_id || !/^\d{4}-\d{2}$/.test(mes ?? "") || monto === undefined || Number(monto) < 0) {
    return NextResponse.json({ error: "Elegí una cuenta, un mes válido (AAAA-MM) y un monto." }, { status: 400 });
  }

  const supabase = createClient();
  const usuarioActualId = await getUsuarioActualId();

  const { data, error } = await supabase
    .from("presupuestos")
    .upsert(
      { cuenta_contable_id, mes, monto, creado_por: usuarioActualId },
      { onConflict: "cuenta_contable_id,mes" }
    )
    .select("*, cuenta_contable:cuentas_contables(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
