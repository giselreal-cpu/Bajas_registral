"use client";

import { useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  navLinks: NavLink[];
  nombreUsuario: string;
}

export default function HeaderNav({ navLinks, nombreUsuario }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
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
        <div className="flex items-center gap-2 text-xs text-slate-500 border-l border-slate-200 pl-3">
          <span className="max-w-[140px] truncate">{nombreUsuario}</span>
          <LogoutButton />
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M2 4h14M2 9h14M2 14h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full bg-white border-b border-slate-200 shadow-md z-20">
            <nav className="flex flex-col px-4 py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="px-2 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-sm text-slate-500">
              <span className="truncate">{nombreUsuario}</span>
              <LogoutButton />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
