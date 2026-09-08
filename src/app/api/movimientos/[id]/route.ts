import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { obtenerCajaPesosId } from "@/lib/cajaPesos";

const ALLOWED_FIELDS = [
  "concepto_id",
  "monto",
  "fecha",
  "observacion",
  "pagado",
  "caja_id",
  "cuenta_contable_id",
  "aprobado"
];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const { data: existente } = await supabase
    .from("movimientos_caso")
    .select("caso_id, factura_id, caja_id")
    .eq("id", params.id)
    .maybeSingle();

  if (existente?.factura_id) {
    return NextResponse.json(
      { error: "No se puede editar un movimiento que ya está en una factura." },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field] === "" ? null : body[field];
  }

  // Si se marca como pagado y ni el movimiento ni esta edición tienen
  // caja asignada, va a "Caja pesos" por defecto (mismo criterio que al
  // cargar un movimiento nuevo ya pagado).
  if (update.pagado === true && !update.caja_id && !existente?.caja_id) {
    update.caja_id = await obtenerCajaPesosId(supabase);
  }

  const { data, error } = await supabase
    .from("movimientos_caso")
    .update(update)
    .eq("id", params.id)
    .select("*, concepto:conceptos_movimiento(*), caja:cajas(*), cuenta_contable:cuentas_contables(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const soloCambioPagado = Object.keys(update).length === 1 && "pagado" in update;
  const soloCambioAprobado = Object.keys(update).length === 1 && "aprobado" in update;
  await registrarCambio(
    data.caso_id,
    soloCambioPagado
      ? `Marcó movimiento como ${data.pagado ? "pagado" : "pendiente de pago"}: ${data.concepto?.nombre ?? "—"}`
      : soloCambioAprobado
      ? `Aprobó gasto cargado desde la app: ${data.concepto?.nombre ?? "—"}`
      : `Editó movimiento: ${data.concepto?.nombre ?? "—"}`
  );

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: existente } = await supabase
    .from("movimientos_caso")
    .select("caso_id, factura_id, monto, concepto:conceptos_movimiento(nombre)")
    .eq("id", params.id)
    .maybeSingle();

  if (existente?.factura_id) {
    return NextResponse.json(
      { error: "No se puede eliminar un movimiento que ya está en una factura." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("movimientos_caso").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existente) {
    const nombreConcepto = (existente.concepto as unknown as { nombre: string } | null)?.nombre ?? "—";
    await registrarCambio(existente.caso_id, `Eliminó movimiento: ${nombreConcepto}`);
  }

  return NextResponse.json({ ok: true });
}
