import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Lora, Poppins } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import LogoutButton from "@/components/LogoutButton";
import MobileNav from "@/components/MobileNav";
import SidebarNav from "@/components/SidebarNav";
import InstallBanner from "@/components/InstallBanner";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { ROLES } from "@/types/database";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-heading" });
// El resto de la app volvió a Inter/Poppins, pero las vistas mobile (.mv)
// ya usaban Cormorant Garamond/Lora desde antes del rebrand Classical —
// mantienen su propia fuente con variables separadas, sin depender de
// --font-body/--font-heading de acá.
const lora = Lora({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mv-body" });
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mv-heading"
});

export const metadata: Metadata = {
  title: "Bajas Registrales por Siniestro",
  description: "Gestión de bajas registrales de vehículos siniestrados",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Oltra Bajas"
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-192.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b68235"
};

// Los 4 destinos principales del rediseño (turno 7 del mockup), arriba
// del todo. El resto de las páginas que ya existían antes no se tocan
// ni se pierden — pasan al sidebar (ver SidebarNav), no al nav
// superior.
const NAV_LINKS_PRIMARIOS = [
  { href: "/panel", label: "Panel" },
  { href: "/casos", label: "Casos" },
  { href: "/administracion", label: "Administración", ocultarParaCompania: true },
  { href: "/analisis", label: "Análisis", ocultarParaCompania: true }
];

const NAV_LINKS_SECUNDARIOS = [
  { href: "/agenda", label: "Agenda", ocultarParaCompania: true },
  { href: "/catalogos", label: "Catálogos", ocultarParaCompania: true },
  { href: "/cuenta-corriente", label: "Cta. Corriente", ocultarParaCompania: true },
  { href: "/seguimiento-financiero", label: "Seguimiento", ocultarParaCompania: true },
  { href: "/exportar", label: "Exportar", ocultarParaCompania: true }
];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const usuarioActual = await getUsuarioActual();

  // Se logueó (hay sesión de Supabase Auth) pero todavía nadie lo vinculó
  // ni le asignó un rol en Catálogos → Usuarios. No debe ver nada del
  // sistema hasta que un administrador lo apruebe.
  const pendienteDeAprobacion = !!user && !usuarioActual;

  const esCompania = usuarioActual?.rol === "compania";
  const navLinksPrimarios = NAV_LINKS_PRIMARIOS.filter(
    (link) => !(link.ocultarParaCompania && esCompania)
  );
  const navLinksSecundarios = NAV_LINKS_SECUNDARIOS.filter(
    (link) => !(link.ocultarParaCompania && esCompania)
  );
  const ahora = new Date();
  const periodo = `Ejercicio ${ahora.getFullYear()} · ${MESES[ahora.getMonth()]}`;
  const rolLabel = usuarioActual ? ROLES.find((r) => r.value === usuarioActual.rol)?.label : null;
  const nombreConRol = usuarioActual?.nombre
    ? rolLabel
      ? `${usuarioActual.nombre} · ${rolLabel}`
      : usuarioActual.nombre
    : (user?.email ?? "");

  return (
    <html
      lang="es"
      className={`${inter.variable} ${poppins.variable} ${lora.variable} ${cormorantGaramond.variable}`}
    >
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-brand-900 relative">
            <div className="mx-auto max-w-[1440px] px-4 py-3 flex items-center justify-between">
              <Link href="/panel" className="flex items-center gap-2.5 group shrink-0">
                <Image
                  src="/logo-oltra.jpg"
                  alt="Oltra Gestión Integral"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-md shrink-0 mix-blend-screen"
                  priority
                />
                <span className="hidden sm:flex flex-col leading-tight">
                  <span className="font-heading font-semibold text-white tracking-tight text-lg">
                    Oltra <span className="text-accent-300">Bajas</span>
                  </span>
                  <span className="text-[11px] text-silver-400 tracking-wide">
                    Gestión Integral Automotor
                  </span>
                </span>
              </Link>
              {user && !pendienteDeAprobacion && (
                <HeaderNav
                  navLinks={navLinksPrimarios}
                  secondaryLinks={navLinksSecundarios}
                  periodo={periodo}
                  nombreUsuario={nombreConRol}
                />
              )}
              {pendienteDeAprobacion && (
                <div className="flex items-center gap-2 text-xs text-silver-300">
                  <span className="max-w-[160px] truncate">{user!.email}</span>
                  <LogoutButton className="text-xs text-silver-300 hover:text-accent-400" />
                </div>
              )}
            </div>
            <div className="h-0.5 bg-gradient-to-r from-accent-600 via-accent-400 to-silver-300" />
          </header>
          <div className="flex-1 flex items-stretch min-h-0">
            {user && !pendienteDeAprobacion && <SidebarNav links={navLinksSecundarios} />}
            <main className="flex-1 min-w-0 mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 md:pb-6">
              {pendienteDeAprobacion ? (
                <div className="max-w-md mx-auto text-center py-16">
                  <h1 className="text-lg font-semibold text-slate-900 mb-2">
                    Cuenta pendiente de aprobación
                  </h1>
                  <p className="text-sm text-slate-500">
                    Tu cuenta ({user!.email}) se creó correctamente, pero todavía
                    no tenés un rol asignado. Pedile a un administrador que te
                    autorice desde Catálogos → Usuarios.
                  </p>
                </div>
              ) : (
                <>
                  <div className="md:hidden mb-4">
                    <InstallBanner />
                  </div>
                  {children}
                </>
              )}
            </main>
          </div>
          {user && !pendienteDeAprobacion && <MobileNav soloLectura={esCompania} />}
        </div>
      </body>
    </html>
  );
}
