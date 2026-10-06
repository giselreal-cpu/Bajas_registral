import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { COLUMNAS, SELECT_CASOS, aFila, generarXlsxCasos } from "@/lib/exportCasos";

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

// GET /api/export/casos            -> CSV (como siempre)
// GET /api/export/casos?formato=xlsx -> Excel con filtros en el encabezado,
// fechas reales y los identificadores guardados como texto.
export async function GET(request: NextRequest) {
  const supabase = createClient();

  let data: any[];
  try {
    data = await traerTodosLosCasos(supabase);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudieron leer los casos.", { status: 500 });
  }

  const filas = data.map(aFila);
  const fecha = new Date().toISOString().slice(0, 10);

  if (request.nextUrl.searchParams.get("formato") === "xlsx") {
    const buffer = await generarXlsxCasos(filas);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="casos_${fecha}.xlsx"`
      }
    });
  }

  const csv = toCsv(
    filas,
    COLUMNAS.map((c) => ({ key: c.key, label: c.label }))
  );
  return csvResponse(csv, `casos_${fecha}.csv`);
}
