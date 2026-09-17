import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { TIPOS_VEHICULO } from "@/types/database";

// PUT /api/casos/[id]/anexo04/tipo-vehiculo -> fija el tipo de vehículo del
// caso y auto-completa caso_piezas_rudac desde reglas_piezas_rudac para ese
// tipo. Solo inserta las piezas que todavía no tienen una fila para este
// caso (on conflict do nothing), para no pisar excepciones puntuales ya
// cargadas a mano si se vuelve a ejecutar (ej. el usuario cambia el tipo
// de vehículo dos veces).
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const { tipo_vehiculo } = body;

  if (!TIPOS_VEHICULO.includes(tipo_vehiculo)) {
    return NextResponse.json({ error: "Tipo de vehículo inválido." }, { status: 400 });
  }

  const supabase = createClient();

  const { data: caso, error: errCaso } = await supabase
    .from("casos")
    .select("vehiculo_id")
    .eq("id", params.id)
    .single();

  if (errCaso || !caso) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  const { error: errVehiculo } = await supabase
    .from("vehiculos")
    .update({ tipo_vehiculo })
    .eq("id", caso.vehiculo_id);

  if (errVehiculo) {
    return NextResponse.json({ error: errVehiculo.message }, { status: 500 });
  }

  const { data: reglas, error: errReglas } = await supabase
    .from("reglas_piezas_rudac")
    .select("codigo, decision")
    .eq("tipo_vehiculo", tipo_vehiculo)
    .in("decision", ["SI", "NO"]);

  if (errReglas) {
    return NextResponse.json({ error: errReglas.message }, { status: 500 });
  }

  if (reglas && reglas.length > 0) {
    const filas = reglas.map((r) => ({ caso_id: params.id, codigo: r.codigo, decision: r.decision }));
    const { error: errAutofill } = await supabase
      .from("caso_piezas_rudac")
      .upsert(filas, { onConflict: "caso_id,codigo", ignoreDuplicates: true });

    if (errAutofill) {
      return NextResponse.json({ error: errAutofill.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
