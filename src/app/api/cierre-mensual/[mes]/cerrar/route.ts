import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { calcularCierre } from "@/lib/cierreMensual";
import { obtenerDatosCierre, obtenerSaldosDeclarados } from "@/lib/cierreMensualDatos";

// POST /api/cierre-mensual/[mes]/cerrar -> cierra el mes: exige el saldo
// real (extracto/arqueo) de cada caja activa, congela un snapshot con
// todos los totales y el detalle, y deja el mes bloqueado (mismo candado
// de siempre: ningún movimiento con fecha en ese mes se puede tocar).
// Solo administrador.
export async function POST(_request: NextRequest, { params }: { params: { mes: string } }) {
  const usuario = await getUsuarioActual();
  if (usuario?.rol !== "administrador") {
    return NextResponse.json({ error: "Solo un administrador puede cerrar un período." }, { status: 403 });
  }
  if (!/^\d{4}-\d{2}$/.test(params.mes)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: yaCerrado } = await supabase.from("cierres_mensuales").select("id").eq("mes", params.mes).maybeSingle();
  if (yaCerrado) {
    return NextResponse.json({ error: "Ese período ya está cerrado." }, { status: 409 });
  }

  const datos = await obtenerDatosCierre(supabase);
  const declarados = await obtenerSaldosDeclarados(supabase, params.mes);
  const declaradasIds = new Set(declarados.map((d) => d.caja_id));

  const { data: cajasActivas } = await supabase.from("cajas").select("id, nombre").eq("activa", true);
  const faltantes = (cajasActivas ?? []).filter((c) => !declaradasIds.has(c.id)).map((c) => c.nombre);
  if (faltantes.length > 0) {
    return NextResponse.json(
      { error: `Falta cargar el saldo real (extracto o arqueo) de: ${faltantes.join(", ")}.` },
      { status: 409 }
    );
  }

  const resultado = calcularCierre(params.mes, datos, declarados);
  const snapshot = { generado_at: new Date().toISOString(), resultado, declarados };

  const { error } = await supabase
    .from("cierres_mensuales")
    .insert({ mes: params.mes, cerrado_por: usuario.id, snapshot });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("cierres_mensuales_historial").insert({
    mes: params.mes,
    accion: "cerrar",
    usuario_id: usuario.id,
    detalle: {
      ingresos: resultado.ingresos,
      egresos: resultado.egresos,
      ganancia: resultado.ganancia,
      saldo_cajas_total: resultado.saldo_cajas_total
    }
  });

  return NextResponse.json({ ok: true });
}
