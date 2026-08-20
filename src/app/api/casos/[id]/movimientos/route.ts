import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { registrarCambio } from "@/lib/historial";

// GET /api/casos/[id]/movimientos -> trazabilidad de costo/ganancia del caso
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movimientos_caso")
    .select("*, concepto:conceptos_movimiento(*)")
    .eq("caso_id", params.id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/casos/[id]/movimientos -> agrega un movimiento (ingreso o egreso)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const usuarioActualId = await getUsuarioActualId();

  const { concepto_id, monto, fecha, observacion } = body;

  if (!concepto_id || monto === undefined || monto === null) {
    return NextResponse.json(
      { error: "El concepto y el monto son obligatorios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("movimientos_caso")
    .insert({
      caso_id: params.id,
      concepto_id,
      monto,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      observacion: observacion || null,
      creado_por: usuarioActualId
    })
    .select("*, concepto:conceptos_movimiento(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambio(
    params.id,
    `Agregó movimiento: ${data.concepto?.nombre ?? "—"}`,
    `$${data.monto}`
  );

  return NextResponse.json({ data }, { status: 201 });
}
