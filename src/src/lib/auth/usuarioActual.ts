import { createClient } from "@/lib/supabase/server";
import { RolUsuario } from "@/types/database";

export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: RolUsuario;
  aseguradora_id: string | null;
}

// Devuelve el usuario de negocio (tabla `usuarios`) vinculado a la sesión
// autenticada actual, con su rol y aseguradora, o null si no hay sesión o
// si la cuenta todavía no fue vinculada (ver /catalogos/usuarios).
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, aseguradora_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data as UsuarioActual | null;
}

export async function getUsuarioActualId(): Promise<string | null> {
  const usuario = await getUsuarioActual();
  return usuario?.id ?? null;
}
