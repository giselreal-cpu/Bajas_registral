import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActualId } from "@/lib/auth/usuarioActual";

// GET /api/anticipos?tipo=compania|desarmadero&receptor_id=... -> lista
// los anticipos de un tercero (disponibles y ya usados).
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const receptorId = searchParams.get("receptor_id");

  if (!tipo || !receptorId) {
    return NextResponse.json({ error: "Faltan tipo y receptor_id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("anticipos")
    .select("*")
    .eq("tipo_receptor", tipo)
    .eq("receptor_id", receptorId)
    .order("fecha", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/anticipos -> registra un anticipo (saldo a favor) para un
// tercero, no atado a ningún caso puntual.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();
  const { tipo_receptor, receptor_id, monto, observacion, fecha } = body;

  if (!tipo_receptor || !receptor_id || !monto || Number(monto) <= 0) {
    return NextResponse.json(
      { error: "Elegí el tercero y cargá un monto válido." },
      { status: 400 }
    );
  }

  const usuarioActualId = await getUsuarioActualId();

  const { data, error } = await supabase
    .from("anticipos")
    .insert({
      tipo_receptor,
      receptor_id,
      monto,
      saldo_disponible: monto,
      observacion: observacion || null,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      creado_por: usuarioActualId
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
