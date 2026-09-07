// Manifest de PWA para los enlaces públicos por token (/g/[token],
// /fb/[token]): mismo ícono/nombre que el manifest general de la app
// (public/manifest.webmanifest), pero con start_url/scope apuntando a
// ESE enlace puntual. El manifest general tiene start_url "/", que
// requiere sesión — si un gestor o la persona de Formulario de Baja
// instalara la app desde ahí (con el diálogo nativo de Android/Chrome,
// que sí respeta start_url del manifest, a diferencia de iOS que
// siempre guarda la URL puntual), el ícono los mandaría a un login al
// que no tienen forma de entrar, porque no tienen cuenta.
export function manifestParaRuta(startUrl: string) {
  return {
    name: "Oltra Bajas",
    short_name: "Oltra Bajas",
    description: "Gestión de bajas registrales de vehículos siniestrados",
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#b85717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
