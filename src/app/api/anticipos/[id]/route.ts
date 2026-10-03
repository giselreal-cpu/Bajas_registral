import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerCajaPesosId, obtenerMonedaCaja } from "@/lib/cajaPesos";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// PUT /api/anticipos/[id] -> corrige un anticipo ya registrado (monto,
// fecha, observación, caja, cuenta contable). Si parte del anticipo ya se
// aplicó a facturas, el monto no puede quedar por debajo de lo ya usado;
// el saldo disponible se recalcula como monto nuevo - usado.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const { data: existente, error: errorExistente } = await supabase
    .from("anticipos")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (errorExistente || !existente) {
    return NextResponse.json({ error: errorExistente?.message ?? "Anticipo no encontrado." }, { status: 404 });
  }

  const nuevoMonto = "monto" in body ? Number(body.monto) : Number(existente.monto);
  if (!nuevoMonto || nuevoMonto <= 0) {
    return NextResponse.json({ error: "Cargá un monto válido." }, { status: 400 });
  }

  const usado = Number(existente.monto) - Number(existente.saldo_disponible);
  if (nuevoMonto < usado) {
    return NextResponse.json(
      { error: `Ya se aplicaron $${usado} de este anticipo a facturas — el monto no puede ser menor.` },
      { status: 409 }
    );
  }

  const nuevaFecha: string = body.fecha || existente.fecha;
  if ((await periodoCerrado(supabase, existente.fecha)) || (await periodoCerrado(supabase, nuevaFecha))) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const update: Record<string, unknown> = {
    monto: nuevoMonto,
    saldo_disponible: nuevoMonto - usado,
    fecha: nuevaFecha
  };
  if ("observacion" in body) update.observacion = body.observacion || null;
  if ("cuenta_contable_id" in body) update.cuenta_contable_id = body.cuenta_contable_id || null;
  if ("caja_id" in body) {
    const cajaFinal = body.caja_id || (await obtenerCajaPesosId(supabase));
    update.caja_id = cajaFinal;
    update.moneda = await obtenerMonedaCaja(supabase, cajaFinal);
  }

  const { data, error } = await supabase
    .from("anticipos")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
