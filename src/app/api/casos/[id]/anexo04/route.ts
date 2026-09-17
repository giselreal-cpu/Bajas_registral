import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import { PIEZAS_RUDAC } from "@/lib/anexo04";

// GET /api/casos/[id]/anexo04 -> estado del checklist para el caso: tipo
// de vehículo, decisión actual por pieza (ya resuelta y persistida en
// caso_piezas_rudac, null = DEPENDE/sin regla/pendiente de revisar), y el
// último Anexo 04 generado (si hay uno).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: caso, error } = await supabase
    .from("casos")
    .select("id, numero_siniestro, vehiculo:vehiculos(id, dominio, tipo_vehiculo)")
    .eq("id", params.id)
    .single();

  if (error || !caso) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  const vehiculo = caso.vehiculo as unknown as { id: string; dominio: string; tipo_vehiculo: string | null } | null;

  const [{ data: decisionesRaw }, { data: documentoActual }] = await Promise.all([
    supabase.from("caso_piezas_rudac").select("codigo, decision, nota").eq("caso_id", params.id),
    supabase
      .from("documentos")
      .select("id, nombre, url, created_at")
      .eq("caso_id", params.id)
      .eq("categoria", "anexo04_rudac")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const decisionesPorCodigo = new Map((decisionesRaw ?? []).map((d) => [d.codigo, d]));

  const piezas = PIEZAS_RUDAC.map((p) => ({
    codigo: p.codigo,
    descripcion: p.descripcion,
    categoria: p.categoria,
    requierePerito: p.requierePerito,
    decision: decisionesPorCodigo.get(p.codigo)?.decision ?? null,
    nota: decisionesPorCodigo.get(p.codigo)?.nota ?? null
  }));

  let documento = null;
  if (documentoActual) {
    documento = { ...documentoActual, url_firmada: await obtenerUrlFirmada(documentoActual.url) };
  }

  return NextResponse.json({
    data: {
      tipoVehiculo: vehiculo?.tipo_vehiculo ?? null,
      dominio: vehiculo?.dominio ?? null,
      piezas,
      documento
    }
  });
}

// PUT /api/casos/[id]/anexo04 -> guarda una excepción puntual para una
// pieza de este caso (pisa lo que haya resuelto la regla general).
// body: { codigo, decision: "SI" | "NO" | null, nota?: string | null }
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const { codigo, decision, nota } = body;

  if (!codigo || (decision !== "SI" && decision !== "NO" && decision !== null)) {
    return NextResponse.json({ error: "Faltan datos o la decisión no es válida." }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("caso_piezas_rudac")
    .upsert(
      { caso_id: params.id, codigo, decision, nota: nota ?? null },
      { onConflict: "caso_id,codigo" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
