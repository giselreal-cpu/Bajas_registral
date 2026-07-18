import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/catalogos -> devuelve todos los catálogos livianos que se usan
// en los selects de los formularios de casos.
export async function GET() {
  const supabase = createClient();

  const [aseguradoras, tiposBaja, usuarios, desarmaderos, registros] =
    await Promise.all([
      supabase.from("aseguradoras").select("*").order("nombre"),
      supabase.from("tipos_baja").select("*").order("nombre"),
      supabase.from("usuarios").select("*").order("nombre"),
      supabase.from("desarmaderos").select("*").order("nombre"),
      supabase.from("registros_automotores").select("*").order("numero")
    ]);

  const firstError =
    aseguradoras.error ||
    tiposBaja.error ||
    usuarios.error ||
    desarmaderos.error ||
    registros.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    aseguradoras: aseguradoras.data,
    tipos_baja: tiposBaja.data,
    // Los usuarios con rol "compania" no son elegibles como responsables
    // de un caso; se filtran acá para no ensuciar los combos de la app.
    usuarios: (usuarios.data ?? []).filter((u: any) => u.rol !== "compania"),
    desarmaderos: desarmaderos.data,
    registros: registros.data
  });
}
