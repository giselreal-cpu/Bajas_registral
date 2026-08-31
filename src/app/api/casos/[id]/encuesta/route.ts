import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/casos/[id]/encuesta -> devuelve la encuesta de satisfacción
// del caso si ya existe (para mostrar el resultado en la bitácora), sin
// crearla. `data: null` si el caso todavía no tiene ninguna.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("encuestas_satisfaccion")
    .select(
      "id, token, calificacion_contacto, calificacion_traslado, calificacion_gestoria, comentario, respondida"
    )
    .eq("caso_id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? null });
}

// POST /api/casos/[id]/encuesta -> get-or-create: si el caso ya tiene
// una encuesta de satisfacción cargada la devuelve tal cual (no se
// duplica), si no crea una nueva. Usa upsert sobre el constraint único
// de caso_id (migración 0038) para que sea atómico — un select-then-
// insert corriente tiene una condición de carrera si el componente que
// dispara esto se monta más de una vez casi al mismo tiempo (creaba
// filas duplicadas para el mismo caso).
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("encuestas_satisfaccion")
    .upsert({ caso_id: params.id }, { onConflict: "caso_id" })
    .select("id, token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
