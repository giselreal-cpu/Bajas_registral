import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

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

// POST /api/cierres-mensuales -> cierra un mes (AAAA-MM). Reservado a
// administrador. Una vez cerrado, ningún movimiento con fecha dentro de
// ese mes se puede crear, editar, anular ni borrar hasta reabrirlo.
export async function POST(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede cerrar un período." }, { status: 403 });
  }

  const body = await request.json();
  const mes = typeof body.mes === "string" ? body.mes.trim() : "";
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "Elegí un mes válido (AAAA-MM)." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_mensuales")
    .insert({ mes, cerrado_por: usuarioActual.id })
    .select("*, cerrado_por_usuario:usuarios(nombre)")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "Ese período ya está cerrado." : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
