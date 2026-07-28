import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCambio } from "@/lib/historial";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios(*)
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("casos")
    .select(CASO_SELECT)
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PUT /api/casos/[id] -> actualiza campos de la cabecera del caso
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const body = await request.json();

  const allowedFields = [
    "numero_siniestro",
    "numero_poliza",
    "item_poliza",
    "aseguradora_id",
    "estado",
    "rama",
    "tipo_tramite",
    "desarmadero_id",
    "registro_id",
    "tipo_baja_id",
    "responsable_id",
    "fecha_cierre",
    "deuda_patentes",
    "deuda_multas",
    "observaciones",
    "tercero_nombre",
    "tercero_dni",
    "tercero_contacto",
    "suma_asegurada",
    "productor_nombre",
    "productor_contacto",
    "tramitador_nombre",
    "tramitador_email"
  ];

  const update: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field];
  }

  const { data, error } = await supabase
    .from("casos")
    .update(update)
    .eq("id", params.id)
    .select(CASO_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si se cambió la aseguradora, ajustamos el número correlativo: si pasa
  // a ser la aseguradora demo, se marca como numero_caso = 0; si deja de
  // serlo (y todavía estaba en 0), se le asigna el próximo número real.
  if ("aseguradora_id" in update) {
    const { data: aseg } = await supabase
      .from("aseguradoras")
      .select("nombre")
      .eq("id", update.aseguradora_id as string)
      .maybeSingle();
    const esDemo = aseg?.nombre === "Aseguradora Demo S.A.";

    if (esDemo && data.numero_caso !== 0) {
      await supabase.from("casos").update({ numero_caso: 0 }).eq("id", params.id);
      data.numero_caso = 0;
    } else if (!esDemo && data.numero_caso === 0) {
      const { data: nuevoNumero } = await supabase.rpc("siguiente_numero_caso");
      if (typeof nuevoNumero === "number") {
        await supabase.from("casos").update({ numero_caso: nuevoNumero }).eq("id", params.id);
        data.numero_caso = nuevoNumero;
      }
    }
  }

  const camposEditados = Object.keys(update).join(", ");
  await registrarCambio(params.id, "Editó datos del caso", camposEditados || null);

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("casos")
    .delete()
    .eq("id", params.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si RLS bloqueó el borrado (por ejemplo, no sos administrador), Supabase
  // no devuelve un error, simplemente no borra nada. Lo detectamos acá.
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "No tenés permiso para eliminar este caso." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
