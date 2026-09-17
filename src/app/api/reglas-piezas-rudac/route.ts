import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { TIPOS_VEHICULO } from "@/types/database";

// GET /api/reglas-piezas-rudac -> todas las reglas cargadas (codigo x tipo
// de vehículo -> decisión). Las combinaciones sin fila cargada se
// consideran "DEPENDE" (pendiente de configurar) en la pantalla admin.
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reglas_piezas_rudac")
    .select("codigo, tipo_vehiculo, decision");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// PUT /api/reglas-piezas-rudac -> guarda una celda de la matriz (una
// pieza x un tipo de vehículo). Admin-only: son las reglas que se
// reusan en todos los casos futuros.
// body: { codigo, tipo_vehiculo, decision: "SI" | "NO" | "DEPENDE" }
export async function PUT(request: NextRequest) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede editar las reglas." }, { status: 403 });
  }

  const body = await request.json();
  const { codigo, tipo_vehiculo, decision } = body;

  if (!codigo || !TIPOS_VEHICULO.includes(tipo_vehiculo) || !["SI", "NO", "DEPENDE"].includes(decision)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("reglas_piezas_rudac")
    .upsert(
      {
        codigo,
        tipo_vehiculo,
        decision,
        actualizado_en: new Date().toISOString(),
        actualizado_por: usuarioActual.id
      },
      { onConflict: "codigo,tipo_vehiculo" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
