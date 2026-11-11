import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { registrarCambio } from "@/lib/historial";

// Si la consulta falla porque todavía no existen las columnas de anulación
// (migración 0078 sin aplicar), se avisa eso en vez de un engañoso "no encontrado".
function errorDeMigracion(error: { message: string } | null | undefined) {
  if (!error || !/anulado|does not exist/i.test(error.message)) return null;
  return NextResponse.json(
    { error: "Falta aplicar la migración 0078 (anulación de casos) en Supabase. Corrés el SQL y vuelve a andar." },
    { status: 503 }
  );
}

// POST /api/casos/[id]/anular { motivo } -> anula el caso (queda registrado
// quién, cuándo y por qué). No borra nada: conserva el número correlativo,
// la bitácora y los movimientos. Equipo interno; un caso cerrado no se anula.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso para anular casos." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (motivo.length < 3) {
    return NextResponse.json({ error: "Indicá el motivo de la anulación." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: caso, error: errorCaso } = await supabase
    .from("casos")
    .select("id, estado, anulado")
    .eq("id", params.id)
    .maybeSingle();
  const sinMigracion = errorDeMigracion(errorCaso);
  if (sinMigracion) return sinMigracion;
  if (!caso) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  if (caso.anulado) return NextResponse.json({ error: "El caso ya está anulado." }, { status: 409 });
  if (caso.estado === "cerrado") {
    return NextResponse.json({ error: "Un caso cerrado no se puede anular." }, { status: 409 });
  }

  const { error } = await supabase
    .from("casos")
    .update({
      anulado: true,
      anulado_motivo: motivo,
      anulado_at: new Date().toISOString(),
      anulado_por: usuario.id
    })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarCambio(params.id, "Anuló el caso", motivo);
  return NextResponse.json({ ok: true });
}

// DELETE /api/casos/[id]/anular -> reactiva un caso anulado (solo administrador).
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede reactivar un caso." }, { status: 403 });
  }

  const supabase = createClient();
  const { data: caso, error: errorCaso } = await supabase
    .from("casos")
    .select("id, anulado, anulado_motivo")
    .eq("id", params.id)
    .maybeSingle();
  const sinMigracion = errorDeMigracion(errorCaso);
  if (sinMigracion) return sinMigracion;
  if (!caso) return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  if (!caso.anulado) return NextResponse.json({ error: "El caso no está anulado." }, { status: 409 });

  const { error } = await supabase
    .from("casos")
    .update({ anulado: false, anulado_motivo: null, anulado_at: null, anulado_por: null })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarCambio(params.id, "Reactivó el caso", caso.anulado_motivo ? `Motivo de la anulación: ${caso.anulado_motivo}` : null);
  return NextResponse.json({ ok: true });
}
