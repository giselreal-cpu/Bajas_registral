import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { registrarCambioGeneral } from "@/lib/historial";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";
import { obtenerMonedaCaja } from "@/lib/cajaPesos";

// GET /api/movimientos-generales -> ingresos/egresos que no son de un
// caso puntual (sueldos, hosting, alquiler, etc.), para /administracion.
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("movimientos_generales")
    .select("*, caja:cajas(*), cuenta_contable:cuentas_contables(*)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/movimientos-generales -> agrega un ingreso/egreso general
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();
  const usuarioActualId = await getUsuarioActualId();

  const { fecha, descripcion, tipo, monto, caja_id, cuenta_contable_id } = body;

  if (!descripcion || !String(descripcion).trim()) {
    return NextResponse.json({ error: "La descripción es obligatoria." }, { status: 400 });
  }
  if (tipo !== "ingreso" && tipo !== "egreso") {
    return NextResponse.json({ error: "El tipo debe ser ingreso o egreso." }, { status: 400 });
  }
  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "El monto es obligatorio." }, { status: 400 });
  }

  const fechaFinal = fecha || new Date().toISOString().slice(0, 10);
  if (await periodoCerrado(supabase, fechaFinal)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const moneda = await obtenerMonedaCaja(supabase, caja_id || null);

  const { data, error } = await supabase
    .from("movimientos_generales")
    .insert({
      fecha: fechaFinal,
      descripcion: String(descripcion).trim(),
      tipo,
      monto,
      caja_id: caja_id || null,
      moneda,
      cuenta_contable_id: cuenta_contable_id || null,
      creado_por: usuarioActualId
    })
    .select("*, caja:cajas(*), cuenta_contable:cuentas_contables(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarCambioGeneral(data.id, `Cargó movimiento general: ${data.descripcion}`, `$${data.monto}`);

  return NextResponse.json({ data }, { status: 201 });
}
