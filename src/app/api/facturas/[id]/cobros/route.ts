import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura, obtenerCuentaContableDeFactura } from "@/lib/facturas";
import { obtenerCajaPesosId, obtenerMonedaCaja } from "@/lib/cajaPesos";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// POST /api/facturas/[id]/cobros -> registra un cobro (parcial o total)
// contra una factura, y recalcula su estado.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { monto, fecha, medio_pago, observacion, caja_id, cuenta_contable_id } = body;

  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "El monto del cobro es obligatorio." }, { status: 400 });
  }

  const { data: factura, error: errorFactura } = await supabase
    .from("facturas")
    .select("id, caso_id, numero_factura, monto_total")
    .eq("id", params.id)
    .maybeSingle();

  if (errorFactura || !factura) {
    return NextResponse.json({ error: errorFactura?.message ?? "Factura no encontrada." }, { status: 404 });
  }

  const fechaFinal = fecha || new Date().toISOString().slice(0, 10);
  if (await periodoCerrado(supabase, fechaFinal)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  // Todo cobro es plata efectivamente recibida — si no se eligió una
  // caja puntual, va a "Caja pesos" por defecto (no queda afuera del
  // Libro de movimientos ni de Liquidez por falta de caja asignada).
  const cajaFinal = caja_id || (await obtenerCajaPesosId(supabase));
  const moneda = await obtenerMonedaCaja(supabase, cajaFinal);
  const cuentaContableFinal =
    cuenta_contable_id || (await obtenerCuentaContableDeFactura(supabase, params.id));

  const { data: cobro, error: errorCobro } = await supabase
    .from("cobros")
    .insert({
      factura_id: params.id,
      monto,
      fecha: fechaFinal,
      medio_pago: medio_pago || null,
      observacion: observacion || null,
      caja_id: cajaFinal,
      moneda,
      cuenta_contable_id: cuentaContableFinal
    })
    .select()
    .single();

  if (errorCobro) {
    return NextResponse.json({ error: errorCobro.message }, { status: 500 });
  }

  const nuevoEstado = await recalcularEstadoFactura(params.id);

  await registrarCambio(
    factura.caso_id,
    `Registró cobro de factura N° ${factura.numero_factura}`,
    `$${monto}`
  );

  return NextResponse.json({ data: cobro, estado: nuevoEstado }, { status: 201 });
}
