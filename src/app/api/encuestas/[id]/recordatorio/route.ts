import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/encuestas/[id]/recordatorio -> reinicia el conteo de 48hs
// hábiles (bumpea ultimo_contacto_at a ahora) para poder reenviar el
// mensaje de WhatsApp como recordatorio.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("encuestas_satisfaccion")
    .update({ ultimo_contacto_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
