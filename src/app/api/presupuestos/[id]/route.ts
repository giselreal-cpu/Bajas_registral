import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

// DELETE /api/presupuestos/[id] -> borra un presupuesto cargado por
// error. Reservado a administrador — a diferencia de los movimientos
// reales, un presupuesto es solo una meta, no plata que se movió, así
// que se puede borrar directo sin necesidad de anulación con motivo.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede borrar un presupuesto." }, { status: 403 });
  }

  const supabase = createClient();
  const { error } = await supabase.from("presupuestos").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
