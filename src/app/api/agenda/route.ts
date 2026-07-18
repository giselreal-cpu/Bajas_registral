import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

// GET /api/agenda?responsable_id=xxx&incluir_completados=true
// Devuelve los eventos de bitácora de todos los casos (no cerrados),
// pensado como agenda/vencimientos: qué hay que hacer y para cuándo.
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const responsableId = searchParams.get("responsable_id");
  const incluirCompletados = searchParams.get("incluir_completados") === "true";

  let query = supabase
    .from("bitacora")
    .select(
      `
      *,
      caso:casos(
        id,
        numero_siniestro,
        estado,
        asegurado:asegurados(nombre),
        responsable:usuarios(id, nombre)
      )
    `
    )
    .order("fecha_fin", { ascending: true, nullsFirst: false });

  if (!incluirCompletados) {
    query = query.eq("completado", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filtramos por responsable del caso (no de la bitácora) después de traer
  // los datos, ya que es un filtro sobre la relación anidada.
  const filtered = responsableId
    ? data?.filter((ev: any) => ev.caso?.responsable?.id === responsableId)
    : data;

  // Dejamos afuera los eventos de casos ya cerrados: no aportan a la agenda.
  const activos = filtered?.filter((ev: any) => ev.caso?.estado !== "cerrado");

  const usuarioActual = await getUsuarioActual();
  const enmascarados = activos?.map((ev: any) => {
    const puedeVer =
      usuarioActual?.rol === "administrador" ||
      ev.caso?.responsable?.id === usuarioActual?.id;
    return ev.es_interna && !puedeVer ? { ...ev, observacion: null } : ev;
  });

  return NextResponse.json({ data: enmascarados });
}
