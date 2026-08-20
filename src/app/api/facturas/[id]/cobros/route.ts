import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura } from "@/lib/facturas";

// POST /api/facturas/[id]/cobros -> registra un cobro (parcial o total)
// contra una factura, y recalcula su estado.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { monto, fecha, medio_pago, observacion } = body;

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

  const { data: cobro, error: errorCobro } = await supabase
    .from("cobros")
    .insert({
      factura_id: params.id,
      monto,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      medio_pago: medio_pago || null,
      observacion: observacion || null
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
