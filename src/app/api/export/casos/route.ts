import { createClient } from "@/lib/supabase/server";
import { SELECT_CASOS, aFila, generarXlsxCasos } from "@/lib/exportCasos";

// PostgREST corta cada respuesta en 1000 filas: se pide por páginas hasta
// traer todos los casos.
async function traerTodosLosCasos(supabase: ReturnType<typeof createClient>) {
  const TAM = 1000;
  const todo: any[] = [];
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await supabase
      .from("casos")
      .select(SELECT_CASOS)
      .order("fecha_ingreso", { ascending: false })
      .order("created_at", { ascending: false })
      .range(desde, desde + TAM - 1);
    if (error) throw new Error(error.message);
    todo.push(...(data ?? []));
    if (!data || data.length < TAM) break;
  }
  return todo;
}

// GET /api/export/casos -> Excel (.xlsx) con todos los casos: filtros en el
// encabezado, fechas reales y los identificadores guardados como texto.
export async function GET() {
  const supabase = createClient();

  let data: any[];
  try {
    data = await traerTodosLosCasos(supabase);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudieron leer los casos.", { status: 500 });
  }

  const buffer = await generarXlsxCasos(data.map(aFila));
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="casos_${fecha}.xlsx"`
    }
  });
}
