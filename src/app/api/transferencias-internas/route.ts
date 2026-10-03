import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { periodoCerrado, ERROR_PERIODO_CERRADO } from "@/lib/cierrePeriodo";

// POST /api/transferencias-internas -> mueve plata entre dos cajas propias
// (depósito de efectivo en el banco, extracción, pase entre cuentas). No
// es cobro ni pago: no toca el resultado ni el Saldo de Cajas total.
export async function POST(request: NextRequest) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }

  const body = await request.json();
  const { caja_origen_id, caja_destino_id, referencia } = body;
  const monto = Number(body.monto);
  const fecha: string = body.fecha || new Date().toISOString().slice(0, 10);

  if (!caja_origen_id || !caja_destino_id || !monto || monto <= 0) {
    return NextResponse.json({ error: "Elegí las dos cajas y cargá un monto válido." }, { status: 400 });
  }
  if (caja_origen_id === caja_destino_id) {
    return NextResponse.json({ error: "La caja de origen y la de destino tienen que ser distintas." }, { status: 400 });
  }

  const supabase = createClient();

  if (await periodoCerrado(supabase, fecha)) {
    return NextResponse.json({ error: ERROR_PERIODO_CERRADO }, { status: 409 });
  }

  const { data: cajas } = await supabase
    .from("cajas")
    .select("id, moneda")
    .in("id", [caja_origen_id, caja_destino_id]);
  if (!cajas || cajas.length !== 2) {
    return NextResponse.json({ error: "Caja no encontrada." }, { status: 404 });
  }
  if (cajas[0].moneda !== cajas[1].moneda) {
    return NextResponse.json(
      { error: "Las dos cajas tienen que ser de la misma moneda (todavía no se convierten monedas)." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("transferencias_internas")
    .insert({
      fecha,
      caja_origen_id,
      caja_destino_id,
      monto,
      referencia: referencia || null,
      creado_por: usuario.id
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("cierres_mensuales_historial").insert({
    mes: fecha.slice(0, 7),
    accion: "transferencia",
    usuario_id: usuario.id,
    detalle: { transferencia_id: data.id, caja_origen_id, caja_destino_id, monto, fecha }
  });

  return NextResponse.json({ data }, { status: 201 });
}
