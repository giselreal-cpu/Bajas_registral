import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";
import { obtenerCajaPesosId } from "@/lib/cajaPesos";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

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

  // Aprobar un gasto de campo o marcarlo pagado mueve plata real —
  // reservado a administrador (evita que la misma persona que cargó el
  // gasto se lo autoapruebe).
  if ("aprobado" in body || "pagado" in body) {
    const usuarioActual = await getUsuarioActual();
    if (usuarioActual?.rol !== "administrador") {
      return NextResponse.json(
        { error: "Solo un administrador puede aprobar un gasto o marcarlo como pagado." },
        { status: 403 }
      );
    }
  }

  const { data: existente } = await supabase
    .from("movimientos_caso")
    .select("caso_id, factura_id, caja_id, fecha")
    .eq("id", params.id)
    .maybeSingle();

  if (existente?.factura_id) {
    return NextResponse.json(
      { error: "No se puede editar un movimiento que ya está en una factura." },
      { status: 409 }
    );
  }

  if (existente && (await periodoCerrado(supabase, existente.fecha))) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }
  if (typeof body.fecha === "string" && body.fecha && (await periodoCerrado(supabase, body.fecha))) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: existente } = await supabase
    .from("movimientos_caso")
    .select("caso_id, factura_id, monto, pagado, fecha, concepto:conceptos_movimiento(nombre)")
    .eq("id", params.id)
    .maybeSingle();

  if (existente?.factura_id) {
    return NextResponse.json(
      { error: "No se puede eliminar un movimiento que ya está en una factura." },
      { status: 409 }
    );
  }

  if (existente && (await periodoCerrado(supabase, existente.fecha))) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const nombreConcepto = (existente?.concepto as unknown as { nombre: string } | null)?.nombre ?? "—";

  // Un egreso ya pagado es plata real que salió — no se borra, se
  // anula con motivo (queda visible en la ficha del caso, tachado, sin
  // sumar a Ganancia neta/Libro/Liquidez). Lo que sigue pendiente de
  // pago se puede seguir borrando libre, no representa nada real
  // todavía.
  if (existente?.pagado) {
    const usuarioActual = await getUsuarioActual();
    if (usuarioActual?.rol !== "administrador") {
      return NextResponse.json(
        { error: "Solo un administrador puede anular un egreso ya pagado." },
        { status: 403 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
    if (!motivo) {
      return NextResponse.json(
        { error: "Un egreso ya pagado no se puede borrar — indicá el motivo de la anulación." },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("movimientos_caso")
      .update({
        anulado: true,
        anulado_motivo: motivo,
        anulado_at: new Date().toISOString(),
        anulado_por: usuarioActual.id
      })
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await registrarCambio(existente.caso_id, `Anuló movimiento: ${nombreConcepto}`, motivo);
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("movimientos_caso").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existente) {
    await registrarCambio(existente.caso_id, `Eliminó movimiento: ${nombreConcepto}`);
  }

  return NextResponse.json({ ok: true });
}
