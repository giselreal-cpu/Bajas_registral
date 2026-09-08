import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

// DELETE /api/cierres-mensuales/[mes] -> reabre un período (AAAA-MM).
// Reservado a administrador — es la única forma de volver a tocar
// movimientos con fecha dentro de un mes ya cerrado.
export async function DELETE(_request: Request, { params }: { params: { mes: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede reabrir un período." }, { status: 403 });
  }

  const supabase = createClient();
  const { error } = await supabase.from("cierres_mensuales").delete().eq("mes", params.mes);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
