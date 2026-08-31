"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function casoIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/casos\/([^/]+)$/);
  if (!m || m[1] === "nuevo") return null;
  return m[1];
}

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const casoId = casoIdFromPathname(pathname);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modo, setModo] = useState<"menu" | "observacion">("menu");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFabClick() {
    if (!casoId) {
      router.push("/casos");
      return;
    }
    setModo("menu");
    setMensaje(null);
    setTexto("");
    setSheetOpen(true);
  }

  async function handleFotoSeleccionada(file: File) {
    if (!casoId) return;
    setSaving(true);
    setMensaje(null);
    try {
      const body = new FormData();
      body.append("categoria", "imagen_dominio");
      body.append("file", file);
      const res = await fetch(`/api/casos/${casoId}/documentos`, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setMensaje("Foto cargada.");
        router.refresh();
        setTimeout(() => setSheetOpen(false), 900);
      } else {
        setMensaje(json?.error ?? "No se pudo subir la foto.");
      }
    } catch {
      setMensaje("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardarObservacion() {
    if (!casoId || !texto.trim()) return;
    setSaving(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/bitacora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_evento: "Observaciones",
          observacion: texto.trim(),
          es_interna: false,
          completado: true,
          fecha_inicio: new Date().toISOString().slice(0, 10),
          fecha_fin: null
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setMensaje("Observación agregada.");
        setTexto("");
        router.refresh();
        setTimeout(() => setSheetOpen(false), 900);
      } else {
        setMensaje(json?.error ?? "No se pudo guardar.");
      }
    } catch {
      setMensaje("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  function irABitacora() {
    setSheetOpen(false);
    window.location.hash = "bitacora";
  }

  return (
    <div className="mv">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFotoSeleccionada(file);
          e.target.value = "";
        }}
      />

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-2 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2"
        style={{ background: "var(--mv-bg)", borderTop: "1px solid var(--mv-divider)" }}
      >
        <NavLink href="/casos" label="Casos" active={pathname.startsWith("/casos")}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </NavLink>
        <NavLink href="/agenda" label="Agenda" active={pathname.startsWith("/agenda")}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </NavLink>

        <button
          onClick={handleFabClick}
          aria-label="Carga rápida"
          className="shrink-0 -mt-6 w-[60px] h-[60px] rounded-full flex items-center justify-center"
          style={{
            border: "1px solid var(--mv-accent)",
            background: "var(--mv-bg)",
            color: "var(--mv-accent)",
            boxShadow: "0 1px 2px rgba(45,43,43,0.14)"
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <NavLink href="/panel" label="Panel" active={pathname.startsWith("/panel")}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M14 9h4M14 14h4" />
        </NavLink>
        <NavLink href="/exportar" label="Exportar" active={pathname.startsWith("/exportar")}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </NavLink>
      </nav>

      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(32,31,29,0.45)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
            style={{
              background: "var(--mv-bg)",
              borderTop: "1px solid var(--mv-divider)",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 12px 32px rgba(45,43,43,0.22)"
            }}
          >
            <div
              className="w-[38px] h-[3px] rounded-full mx-auto mb-3.5"
              style={{ background: "var(--mv-neutral-400)" }}
            />
            {modo === "menu" ? (
              <>
                <h2 className="mv-heading text-lg mb-1">Carga rápida</h2>
                {mensaje && <p className="text-sm mb-2" style={{ color: "var(--mv-accent-700)" }}>{mensaje}</p>}
                <div className="flex flex-col gap-2.5 mt-2">
                  <SheetAction
                    label="Sacar foto del dominio"
                    hint="Se adjunta al caso abierto"
                    disabled={saving}
                    onClick={() => fileInputRef.current?.click()}
                  />
                  <SheetAction
                    label="Agregar una observación"
                    hint="Bitácora — con fecha de hoy"
                    onClick={() => setModo("observacion")}
                  />
                  <SheetAction label="Ir a Bitácora" hint="Ver y completar eventos" onClick={irABitacora} />
                </div>
              </>
            ) : (
              <>
                <h2 className="mv-heading text-lg mb-2">Agregar una observación</h2>
                {mensaje && <p className="text-sm mb-2" style={{ color: "var(--mv-accent-700)" }}>{mensaje}</p>}
                <textarea
                  className="mv-input"
                  rows={3}
                  placeholder="Ej.: turno en el registro para el 04/09 a las 10:30"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  style={{ resize: "none" }}
                />
                <div className="flex gap-2.5 mt-3">
                  <button
                    type="button"
                    className="mv-btn mv-btn-secondary flex-1"
                    style={{ minHeight: 46 }}
                    onClick={() => setModo("menu")}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    className="mv-btn mv-btn-primary flex-1"
                    style={{ minHeight: 46 }}
                    disabled={saving || !texto.trim()}
                    onClick={handleGuardarObservacion}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SheetAction({
  label,
  hint,
  onClick,
  disabled
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mv-card flex items-center justify-between gap-3 w-full text-left px-3.5 py-3"
      style={{ minHeight: 56 }}
    >
      <span>
        <span className="mv-heading block text-[15px]">{label}</span>
        <span className="block text-[11.5px] mt-0.5" style={{ color: "var(--mv-neutral-600)" }}>
          {hint}
        </span>
      </span>
      <span style={{ color: "var(--mv-accent)" }}>→</span>
    </button>
  );
}

function NavLink({
  href,
  label,
  active,
  children
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mv-heading flex flex-col items-center gap-1 min-w-[58px] py-1 text-[12.5px]"
      style={{ color: active ? "var(--mv-accent-700)" : "var(--mv-neutral-600)" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {label}
    </Link>
  );
}
