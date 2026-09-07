"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "oltra-a2i-dismissed";

const PASOS_IOS = [
  "Tocá el botón Compartir, abajo en la barra de Safari.",
  "Deslizá y elegí «Agregar a pantalla de inicio».",
  "Confirmá con «Agregar». Queda como Oltra Bajas."
];

const PASOS_ANDROID = [
  "Tocá los tres puntos, arriba a la derecha de Chrome.",
  "Elegí «Agregar a pantalla principal» o «Instalar app».",
  "Confirmá con «Instalar». Queda como Oltra Bajas."
];

function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function yaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return !!standalone || !!iosStandalone;
}

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [plataforma, setPlataforma] = useState<"ios" | "android">("ios");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (yaInstalada()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setPlataforma(esIOS() ? "ios" : "android");
    setVisible(true);

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function cerrarBanner() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function agregarAlInicio() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        localStorage.setItem(DISMISS_KEY, "1");
        setVisible(false);
      }
      return;
    }
    setSheetAbierto(true);
  }

  if (!visible) return null;

  const pasos = plataforma === "ios" ? PASOS_IOS : PASOS_ANDROID;

  return (
    <div className="mv">
      <div
        className="flex items-start gap-3 p-3.5"
        style={{
          border: "1px solid var(--mv-accent)",
          borderRadius: "var(--mv-radius-md)",
          background: "rgba(182,130,53,0.07)"
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--mv-accent)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 mt-0.5"
        >
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 8v6" />
          <path d="M9 11h6" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="mv-heading text-[14.5px]" style={{ color: "var(--mv-accent-700)" }}>
            Tenelo a mano: agregalo a tu pantalla de inicio
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--mv-neutral-700)" }}>
            Queda como un ícono y entrás sin buscar el enlace, sin necesitar usuario ni contraseña.
          </p>
          <div className="flex gap-2 mt-3">
            <button className="mv-btn mv-btn-primary text-xs px-3.5 py-1.5" onClick={agregarAlInicio}>
              Agregar al inicio
            </button>
            <button className="mv-btn mv-btn-secondary text-xs px-3.5 py-1.5" onClick={cerrarBanner}>
              Ahora no
            </button>
          </div>
        </div>
      </div>

      {sheetAbierto && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(32,31,29,0.45)" }}
            onClick={() => setSheetAbierto(false)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] max-w-2xl mx-auto"
            style={{
              background: "var(--mv-bg)",
              borderTop: "1px solid var(--mv-divider)",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 12px 32px rgba(45,43,43,0.22)"
            }}
          >
            <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ background: "var(--mv-neutral-400)" }} />
            <h2 className="mv-heading text-lg mb-3">Agregar a pantalla de inicio</h2>
            <div
              className="flex mb-4 rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--mv-divider)" }}
            >
              <button
                className="mv-heading flex-1 py-2 text-xs"
                style={
                  plataforma === "ios"
                    ? { background: "var(--mv-accent-100)", color: "var(--mv-accent-700)" }
                    : { color: "var(--mv-neutral-700)" }
                }
                onClick={() => setPlataforma("ios")}
              >
                iPhone (Safari)
              </button>
              <button
                className="mv-heading flex-1 py-2 text-xs"
                style={{
                  borderLeft: "1px solid var(--mv-divider)",
                  ...(plataforma === "android"
                    ? { background: "var(--mv-accent-100)", color: "var(--mv-accent-700)" }
                    : { color: "var(--mv-neutral-700)" })
                }}
                onClick={() => setPlataforma("android")}
              >
                Android (Chrome)
              </button>
            </div>
            <div className="space-y-3">
              {pasos.map((texto, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center tabular-nums"
                    style={{ border: "1px solid var(--mv-accent)", color: "var(--mv-accent-700)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm pt-0.5" style={{ color: "var(--mv-neutral-800)" }}>
                    {texto}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="mv-btn mv-btn-primary w-full mt-4 py-2.5"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, "1");
                setSheetAbierto(false);
                setVisible(false);
              }}
            >
              Ya lo agregué
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
