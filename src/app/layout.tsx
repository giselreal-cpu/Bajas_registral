import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: "Bajas Registrales por Siniestro",
  description: "Gestión de bajas registrales de vehículos siniestrados"
};

const NAV_LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/casos", label: "Casos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/catalogos", label: "Catálogos", ocultarParaCompania: true },
  { href: "/exportar", label: "Exportar" }
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

  const navLinks = NAV_LINKS.filter(
    (link) => !(link.ocultarParaCompania && usuarioActual?.rol === "compania")
  );

  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-slate-200">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <Link href="/panel" className="flex items-center gap-2.5 group">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white text-sm font-bold tracking-tight group-hover:bg-brand-800 transition-colors">
                  BR
                </span>
                <span className="font-heading font-semibold text-slate-800 tracking-tight">
                  Bajas Registrales
                </span>
              </Link>
              <div className="flex items-center gap-3">
                {user && (
                  <nav className="text-sm font-medium flex gap-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="px-3 py-1.5 rounded-md text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                )}
                {user && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 border-l border-slate-200 pl-3">
                    <span className="max-w-[140px] truncate">
                      {usuarioActual?.nombre ?? user.email}
                    </span>
                    <LogoutButton />
                  </div>
                )}
              </div>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-brand-700 via-brand-400 to-accent-400" />
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
