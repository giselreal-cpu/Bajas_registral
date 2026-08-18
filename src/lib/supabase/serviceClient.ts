import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con la service role key: ignora RLS por completo. SOLO se usa
// server-side (Route Handlers, Server Actions, Server Components) para los
// casos en los que no hay una sesión de usuario para validar contra RLS —
// hoy, únicamente el flujo del gestor externo (enlace público sin login) y
// la subida de archivos a Storage. Nunca importar este archivo desde un
// componente cliente ("use client").
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
