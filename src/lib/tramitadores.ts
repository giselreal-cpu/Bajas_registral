import { createClient } from "@/lib/supabase/server";

export interface TramitadorResuelto {
  id: string;
  nombre: string;
  email: string | null;
}

// Resuelve el trámitador de un caso a partir de lo que mande el cliente:
// - `tramitadorId` (elegido en el desplegable de la compañía): se toma
//   tal cual, con su nombre y email del catálogo.
// - o solo `nombre` (llamadas viejas / API): se busca dentro de esa
//   aseguradora sin distinguir mayúsculas/espacios, o se crea.
// Los campos de texto del caso (tramitador_nombre / tramitador_email)
// se completan siempre desde el resultado, así notificaciones y
// exports siguen leyéndolos igual.
export async function resolverTramitador(
  supabase: ReturnType<typeof createClient>,
  datos: {
    tramitadorId?: string | null;
    nombre?: string | null;
    email?: string | null;
    aseguradoraId?: string | null;
  }
): Promise<TramitadorResuelto | null> {
  if (datos.tramitadorId) {
    const { data } = await supabase
      .from("tramitadores")
      .select("id, nombre, email")
      .eq("id", datos.tramitadorId)
      .maybeSingle();
    return data ?? null;
  }

  const nombreLimpio = datos.nombre?.trim();
  if (!nombreLimpio || !datos.aseguradoraId) return null;

  const buscar = () =>
    supabase
      .from("tramitadores")
      .select("id, nombre, email")
      .eq("aseguradora_id", datos.aseguradoraId!)
      .ilike("nombre", nombreLimpio)
      .maybeSingle();

  const { data: existente } = await buscar();
  if (existente) return existente;

  const { data: nuevo, error } = await supabase
    .from("tramitadores")
    .insert({
      nombre: nombreLimpio,
      email: datos.email?.trim() || null,
      aseguradora_id: datos.aseguradoraId
    })
    .select("id, nombre, email")
    .single();

  // Carrera con otro request: el índice único hace fallar el insert.
  if (error) {
    const { data: reintento } = await buscar();
    return reintento ?? null;
  }

  return nuevo;
}
