import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { recalcularEstadoFactura, saldoPendienteFactura } from "@/lib/facturas";

// POST /api/facturas/[id]/aplicar-anticipo -> cubre (parcial o
// totalmente) el saldo pendiente de una factura con un anticipo ya
// cargado del mismo tercero, sin importar en qué caso se generó ese
// anticipo.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { anticipo_id, monto } = body;

  if (!anticipo_id || !monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "Elegí un anticipo y cargá un monto válido." }, { status: 400 });
  }

  const [{ data: factura, error: errorFactura }, { data: anticipo, error: errorAnticipo }] =
    await Promise.all([
      supabase
        .from("facturas")
        .select("id, caso_id, numero_factura, tipo_receptor, receptor_id")
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("anticipos").select("*").eq("id", anticipo_id).maybeSingle()
    ]);

  if (errorFactura || !factura) {
    return NextResponse.json({ error: errorFactura?.message ?? "Factura no encontrada." }, { status: 404 });
  }
  if (errorAnticipo || !anticipo) {
    return NextResponse.json({ error: errorAnticipo?.message ?? "Anticipo no encontrado." }, { status: 404 });
  }

  if (anticipo.tipo_receptor !== factura.tipo_receptor || anticipo.receptor_id !== factura.receptor_id) {
    return NextResponse.json(
      { error: "El anticipo no pertenece al mismo tercero que la factura." },
      { status: 409 }
    );
  }

  if (Number(monto) > Number(anticipo.saldo_disponible)) {
    return NextResponse.json(
      { error: `El anticipo solo tiene ${anticipo.saldo_disponible} disponibles.` },
      { status: 409 }
    );
  }

  const saldoPendiente = await saldoPendienteFactura(params.id);
  if (Number(monto) > saldoPendiente) {
    return NextResponse.json(
      { error: `La factura solo tiene ${saldoPendiente} pendientes de cobro.` },
      { status: 409 }
    );
  }

  const { data: cobro, error: errorCobro } = await supabase
    .from("cobros")
    .insert({
      factura_id: params.id,
      monto,
      medio_pago: "Anticipo",
      anticipo_id
    })
    .select()
    .single();

  if (errorCobro) {
    return NextResponse.json({ error: errorCobro.message }, { status: 500 });
  }

  await supabase
    .from("anticipos")
    .update({ saldo_disponible: Number(anticipo.saldo_disponible) - Number(monto) })
    .eq("id", anticipo_id);

  const nuevoEstado = await recalcularEstadoFactura(params.id);

  await registrarCambio(
    factura.caso_id,
    `Aplicó anticipo a factura N° ${factura.numero_factura}`,
    `$${monto}`
  );

  return NextResponse.json({ data: cobro, estado: nuevoEstado }, { status: 201 });
}
