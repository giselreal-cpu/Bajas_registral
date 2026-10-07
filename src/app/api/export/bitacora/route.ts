import { createClient } from "@/lib/supabase/server";
import { generarXlsxTabla, traerTodo, xlsxResponse } from "@/lib/xlsxTabla";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export async function GET() {
  const supabase = createClient();
  const usuarioActual = await getUsuarioActual();

  let data: any[];
  try {
    data = await traerTodo<any>((d, h) =>
      supabase
        .from("bitacora")
        .select(
          `
      tipo_evento, observacion, es_interna, completado, fecha_inicio, fecha_fin, created_at,
      caso:casos(numero_siniestro, responsable:usuarios(id)),
      usuario:usuarios(nombre)
    `
        )
        .order("fecha_inicio", { ascending: false })
        .order("created_at", { ascending: false })
        .range(d, h)
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudo leer la bitácora.", { status: 500 });
  }

  const filas = data.map((b: any) => {
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

  const buffer = await generarXlsxTabla(
    "Bitácora",
    [
      { key: "numero_siniestro", label: "N° Siniestro", tipo: "texto", ancho: 18 },
      { key: "tipo_evento", label: "Tipo de Evento", ancho: 30 },
      { key: "observacion", label: "Observación", ancho: 60 },
      { key: "es_interna", label: "Interna", ancho: 9 },
      { key: "completado", label: "Completado", ancho: 12 },
      { key: "fecha_inicio", label: "Fecha Inicio", tipo: "fecha" },
      { key: "fecha_fin", label: "Fecha Fin", tipo: "fecha" },
      { key: "cargado_por", label: "Cargado Por", ancho: 22 }
    ],
    filas
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `bitacora_${fecha}.xlsx`);
}
