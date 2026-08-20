import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActualId } from "@/lib/auth/usuarioActual";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura, saldoPendienteFactura } from "@/lib/facturas";

// POST /api/facturas/[id]/notas-credito -> ajusta el saldo pendiente de
// una factura ya emitida sin borrarla (error de facturación, descuento
// acordado, etc.), y recalcula su estado.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { monto, motivo, fecha } = body;

  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "El monto de la nota de crédito es obligatorio." }, { status: 400 });
  }
  if (!motivo || !String(motivo).trim()) {
    return NextResponse.json({ error: "El motivo de la nota de crédito es obligatorio." }, { status: 400 });
  }

  const { data: factura, error: errorFactura } = await supabase
    .from("facturas")
    .select("id, caso_id, numero_factura")
    .eq("id", params.id)
    .maybeSingle();

  if (errorFactura || !factura) {
    return NextResponse.json({ error: errorFactura?.message ?? "Factura no encontrada." }, { status: 404 });
  }

  const saldoPendiente = await saldoPendienteFactura(params.id);
  if (Number(monto) > saldoPendiente) {
    return NextResponse.json(
      { error: `La nota de crédito no puede superar el saldo pendiente de la factura (${saldoPendiente}).` },
      { status: 409 }
    );
  }

  const usuarioActualId = await getUsuarioActualId();

  const { data: nota, error: errorNota } = await supabase
    .from("notas_credito")
    .insert({
      factura_id: params.id,
      monto,
      motivo,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      creado_por: usuarioActualId
    })
    .select()
    .single();

  if (errorNota) {
    return NextResponse.json({ error: errorNota.message }, { status: 500 });
  }

  const nuevoEstado = await recalcularEstadoFactura(params.id);

  await registrarCambio(
    factura.caso_id,
    `Emitió nota de crédito de factura N° ${factura.numero_factura}`,
    `$${monto} — ${motivo}`
  );

  return NextResponse.json({ data: nota, estado: nuevoEstado }, { status: 201 });
}
