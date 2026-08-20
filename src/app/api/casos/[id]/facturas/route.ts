import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

// GET /api/casos/[id]/facturas -> facturas del caso, con sus cobros
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("*, cobros(*), notas_credito(*)")
    .eq("caso_id", params.id)
    .order("fecha_emision", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/casos/[id]/facturas -> genera una factura agrupando movimientos
// de ingreso sin facturar todavía, hacia un receptor (compañía o desarmadero).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();
  const { tipo_receptor, receptor_id, movimiento_ids } = body;

  if (!tipo_receptor || !receptor_id || !Array.isArray(movimiento_ids) || movimiento_ids.length === 0) {
    return NextResponse.json(
      { error: "Elegí el receptor y al menos un movimiento para facturar." },
      { status: 400 }
    );
  }

  const { data: movimientos, error: errorMov } = await supabase
    .from("movimientos_caso")
    .select("id, monto, factura_id, concepto:conceptos_movimiento(tipo)")
    .eq("caso_id", params.id)
    .in("id", movimiento_ids);

  if (errorMov) {
    return NextResponse.json({ error: errorMov.message }, { status: 500 });
  }

  const invalidos = (movimientos ?? []).filter(
    (m) =>
      m.factura_id !== null ||
      (m.concepto as unknown as { tipo: string } | null)?.tipo !== "ingreso"
  );
  if (invalidos.length > 0 || (movimientos ?? []).length !== movimiento_ids.length) {
    return NextResponse.json(
      {
        error:
          "Solo se pueden facturar movimientos de ingreso de este caso que todavía no estén en otra factura."
      },
      { status: 409 }
    );
  }

  const montoTotal = (movimientos ?? []).reduce((acc, m) => acc + Number(m.monto), 0);

  const { data: factura, error: errorFactura } = await supabase
    .from("facturas")
    .insert({
      caso_id: params.id,
      tipo_receptor,
      receptor_id,
      monto_total: montoTotal
    })
    .select()
    .single();

  if (errorFactura) {
    return NextResponse.json({ error: errorFactura.message }, { status: 500 });
  }

  const { error: errorUpdate } = await supabase
    .from("movimientos_caso")
    .update({ factura_id: factura.id })
    .in("id", movimiento_ids);

  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 });
  }

  await registrarCambio(
    params.id,
    `Generó factura N° ${factura.numero_factura}`,
    `$${montoTotal} a ${tipo_receptor === "compania" ? "la compañía" : "el desarmadero"}`
  );

  return NextResponse.json({ data: factura }, { status: 201 });
}
