"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: NavLink[];
}

// Barra lateral para las páginas "secundarias" que ya existían antes
// del rediseño (Agenda, Catálogos, Cta. Corriente, Seguimiento,
// Exportar) — mismo patrón visual que el sub-menú que ya tiene
// /administracion (borde de acento a la izquierda en el activo).
export default function SidebarNav({ links }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block shrink-0 w-[190px] border-r border-silver-200 bg-silver-100">
      <div className="py-4">
        <div className="px-4 pb-2 text-[10.5px] uppercase tracking-wide text-silver-500">
          Más módulos
        </div>
        <nav className="flex flex-col">
          {links.map((link) => {
            const activo = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2.5 text-sm font-heading font-semibold border-l-2 ${
                  activo
                    ? "bg-white border-accent-600 text-brand-900"
                    : "border-transparent text-brand-600 hover:bg-white/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
