import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export async function GET() {
  const supabase = createClient();
  const usuarioActual = await getUsuarioActual();

  const { data, error } = await supabase
    .from("bitacora")
    .select(
      `
      tipo_evento, observacion, es_interna, completado, fecha_inicio, fecha_fin, created_at,
      caso:casos(numero_siniestro, responsable:usuarios(id)),
      usuario:usuarios(nombre)
    `
    )
    .order("fecha_inicio", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filas = (data ?? []).map((b: any) => {
    const puedeVer =
      !b.es_interna ||
      usuarioActual?.rol === "administrador" ||
      b.caso?.responsable?.id === usuarioActual?.id;
    return {
      numero_siniestro: b.caso?.numero_siniestro ?? "",
      tipo_evento: b.tipo_evento,
      observacion: puedeVer ? b.observacion ?? "" : "[Observación interna - oculta]",
      es_interna: b.es_interna ? "Sí" : "No",
      completado: b.completado ? "Sí" : "No",
      fecha_inicio: b.fecha_inicio,
      fecha_fin: b.fecha_fin ?? "",
      cargado_por: b.usuario?.nombre ?? ""
    };
  });

  const csv = toCsv(filas, [
    { key: "numero_siniestro", label: "N° Siniestro" },
    { key: "tipo_evento", label: "Tipo de Evento" },
    { key: "observacion", label: "Observación" },
    { key: "es_interna", label: "Interna" },
    { key: "completado", label: "Completado" },
    { key: "fecha_inicio", label: "Fecha Inicio" },
    { key: "fecha_fin", label: "Fecha Fin" },
    { key: "cargado_por", label: "Cargado Por" }
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `bitacora_${fecha}.csv`);
}
