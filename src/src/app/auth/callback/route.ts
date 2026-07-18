import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Después de loguearse con Google, Supabase redirige acá con un ?code=...
// Lo intercambiamos por una sesión real y recién ahí mandamos a la persona
// a donde tenía que ir (por defecto, /panel).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") || "/panel";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
