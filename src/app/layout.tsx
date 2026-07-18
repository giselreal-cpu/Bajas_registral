import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bajas Registrales por Siniestro",
  description: "Gestión de bajas registrales de vehículos siniestrados"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <Link href="/panel" className="font-semibold text-slate-800">
                Bajas Registrales
              </Link>
              <nav className="text-sm text-slate-500 flex gap-4">
                <Link href="/panel" className="hover:text-brand-600">
                  Panel
                </Link>
                <Link href="/casos" className="hover:text-brand-600">
                  Casos
                </Link>
                <Link href="/agenda" className="hover:text-brand-600">
                  Agenda
                </Link>
                <Link href="/catalogos" className="hover:text-brand-600">
                  Catálogos
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
