import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/catalogos -> devuelve los catálogos livianos que se usan en
// CasoForm (alta de caso) y AgendaList (filtro por responsable). Antes
// también traía desarmaderos y registros_automotores (835 filas, por
// lejos la consulta más pesada de las cinco) pero ningún consumidor los
// usa — el registro/desarmadero se asignan desde otro lado (ver
// 0036_desarmadero_en_evento.sql) — así que se sacaron para no cargar
// esas 835 filas en cada apertura de "Nuevo caso" o de la Agenda.
export async function GET() {
  const supabase = createClient();

  const [aseguradoras, tiposBaja, usuarios] = await Promise.all([
    supabase.from("aseguradoras").select("*").order("nombre"),
    supabase.from("tipos_baja").select("*").order("nombre"),
    supabase.from("usuarios").select("*").order("nombre")
  ]);

  const firstError = aseguradoras.error || tiposBaja.error || usuarios.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    aseguradoras: aseguradoras.data,
    tipos_baja: tiposBaja.data,
    // Los usuarios con rol "compania" no son elegibles como responsables
    // de un caso; se filtran acá para no ensuciar los combos de la app.
    usuarios: (usuarios.data ?? []).filter((u: any) => u.rol !== "compania")
  });
}
