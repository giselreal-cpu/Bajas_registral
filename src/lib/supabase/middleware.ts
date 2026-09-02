import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esLogin = pathname.startsWith("/login");
  const esAuthCallback = pathname.startsWith("/auth");
  const esApi = pathname.startsWith("/api");
  // Enlace público del gestor de campo: no requiere sesión. La carga de
  // archivos se hace con una Server Action (POST a esta misma ruta, no a
  // /api/...), así que esta única excepción alcanza.
  const esGestorPublico = pathname.startsWith("/g/");
  // Enlace público del gruero asignado a un traslado: solo lectura/descarga
  // (resumen del caso, fotos del dominio, autorización en .docx).
  const esGrueroPublico = pathname.startsWith("/gr/");
  // Enlace público de la persona asignada al Formulario de Baja (04D):
  // puede ver un resumen acotado del caso y subir el documento completado,
  // sin necesitar cuenta.
  const esFormularioBajaPublico = pathname.startsWith("/fb/");
  // Enlace público de la encuesta de satisfacción: sin login, se
  // responde una única vez.
  const esEncuestaPublica = pathname.startsWith("/encuesta/");
  // Hub público del gestor (histórico de todas sus asignaciones), token
  // propio de la persona, separado del token por caso de arriba.
  const esGestorHubPublico = pathname.startsWith("/gestor/");
  // Manifest de PWA por token para los enlaces públicos de arriba: el
  // navegador los pide sin cookies de sesión al instalar el ícono.
  const esManifestPublico =
    pathname.startsWith("/api/manifest-gestor-hub/") ||
    pathname.startsWith("/api/manifest-formulario-baja/");

  if (!user) {
    if (
      esGestorPublico ||
      esGrueroPublico ||
      esFormularioBajaPublico ||
      esEncuestaPublica ||
      esGestorHubPublico ||
      esManifestPublico
    ) {
      return response;
    }
    if (esApi) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (!esLogin && !esAuthCallback) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (user && esLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
