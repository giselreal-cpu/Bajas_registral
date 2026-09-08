import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { registrarCambio } from "@/lib/historial";
import { obtenerCajaPesosId } from "@/lib/cajaPesos";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// GET /api/casos/[id]/movimientos -> trazabilidad de costo/ganancia del caso
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movimientos_caso")
    .select("*, concepto:conceptos_movimiento(*), caja:cajas(*), cuenta_contable:cuentas_contables(*)")
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

  const {
    concepto_id,
    monto,
    fecha,
    observacion,
    pagado,
    caja_id,
    cuenta_contable_id,
    documento_id,
    aprobado
  } = body;

  if (!concepto_id || monto === undefined || monto === null) {
    return NextResponse.json(
      { error: "El concepto y el monto son obligatorios." },
      { status: 400 }
    );
  }

  const fechaFinal = fecha || new Date().toISOString().slice(0, 10);
  if (await periodoCerrado(supabase, fechaFinal)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  // Todo movimiento que se carga ya pagado y sin caja elegida va a
  // "Caja pesos" por defecto, para que no quede afuera del Libro de
  // movimientos ni de Liquidez por falta de caja asignada.
  const cajaFinal = caja_id || (pagado ? await obtenerCajaPesosId(supabase) : null);

  const { data, error } = await supabase
    .from("movimientos_caso")
    .insert({
      caso_id: params.id,
      concepto_id,
      monto,
      fecha: fechaFinal,
      observacion: observacion || null,
      pagado: !!pagado,
      caja_id: cajaFinal,
      cuenta_contable_id: cuenta_contable_id || null,
      documento_id: documento_id || null,
      // Solo la carga móvil de gastos (Caja → Registrar gasto) manda
      // aprobado explícitamente en false; la carga de escritorio no
      // envía este campo y queda aprobado por default, sin cambiar su
      // comportamiento de siempre.
      aprobado: aprobado === false ? false : true,
      creado_por: usuarioActualId
    })
    .select("*, concepto:conceptos_movimiento(*), caja:cajas(*), cuenta_contable:cuentas_contables(*)")
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
