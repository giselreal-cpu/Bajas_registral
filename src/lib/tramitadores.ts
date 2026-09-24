import { createClient } from "@/lib/supabase/server";

// Busca (sin distinguir mayúsculas/espacios) o crea un trámitador a
// partir del nombre libre que se carga en el caso, y devuelve su id —
// así el catálogo (tabla tramitadores) se va completando solo, sin
// tocar el formulario de alta/edición del caso. No pisa el email de un
// trámitador ya existente con uno distinto: si hace falta corregirlo,
// se edita desde /catalogos/tramitadores.
export async function resolverTramitadorId(
  supabase: ReturnType<typeof createClient>,
  nombre: string | null | undefined,
  email: string | null | undefined
): Promise<string | null> {
  const nombreLimpio = nombre?.trim();
  if (!nombreLimpio) return null;

  const { data: existente } = await supabase
    .from("tramitadores")
    .select("id")
    .ilike("nombre", nombreLimpio)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nuevo, error } = await supabase
    .from("tramitadores")
    .insert({ nombre: nombreLimpio, email: email?.trim() || null })
    .select("id")
    .single();

  // Si otro request lo creó en simultáneo, el unique constraint de
  // "nombre" hace fallar el insert — se busca de nuevo en vez de romper
  // la carga del caso por esta carrera.
  if (error) {
    const { data: reintento } = await supabase
      .from("tramitadores")
      .select("id")
      .ilike("nombre", nombreLimpio)
      .maybeSingle();
    return reintento?.id ?? null;
  }

  return nuevo.id;
}
