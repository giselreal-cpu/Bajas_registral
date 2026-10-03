import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

// POST /api/cierre-mensual/[mes]/saldos -> carga (o corrige) el saldo REAL
// de una caja para el mes: extracto bancario en cajas de banco, arqueo
// físico en las demás. Cada carga o cambio queda en el historial.
export async function POST(request: NextRequest, { params }: { params: { mes: string } }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso para cargar saldos." }, { status: 403 });
  }
  if (!/^\d{4}-\d{2}$/.test(params.mes)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }

  const body = await request.json();
  const cajaId = typeof body.caja_id === "string" ? body.caja_id : "";
  const saldo = Number(body.saldo_declarado);
  if (!cajaId || body.saldo_declarado === "" || body.saldo_declarado === null || Number.isNaN(saldo)) {
    return NextResponse.json({ error: "Elegí la caja y cargá un saldo." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: cerrado } = await supabase.from("cierres_mensuales").select("id").eq("mes", params.mes).maybeSingle();
  if (cerrado) {
    return NextResponse.json(
      { error: "Ese mes está cerrado — un administrador tiene que reabrirlo para cambiar los saldos." },
      { status: 409 }
    );
  }

  const { data: caja } = await supabase.from("cajas").select("id, nombre, tipo").eq("id", cajaId).maybeSingle();
  if (!caja) {
    return NextResponse.json({ error: "Caja no encontrada." }, { status: 404 });
  }
  const tipo = caja.tipo === "banco" || caja.tipo === "financiera" ? "extracto" : "arqueo";

  const { data: anterior } = await supabase
    .from("cierres_saldos_declarados")
    .select("saldo_declarado")
    .eq("mes", params.mes)
    .eq("caja_id", cajaId)
    .maybeSingle();

  const { error } = await supabase.from("cierres_saldos_declarados").upsert(
    {
      mes: params.mes,
      caja_id: cajaId,
      tipo,
      saldo_declarado: saldo,
      declarado_por: usuario.id,
      declarado_at: new Date().toISOString()
    },
    { onConflict: "mes,caja_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("cierres_mensuales_historial").insert({
    mes: params.mes,
    accion: "arqueo",
    usuario_id: usuario.id,
    detalle: {
      caja: caja.nombre,
      tipo,
      saldo_anterior: anterior ? Number(anterior.saldo_declarado) : null,
      saldo_nuevo: saldo
    }
  });

  return NextResponse.json({ ok: true });
}
