"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Aseguradora,
  CasoConRelaciones,
  ESTADOS,
  Gestor,
  RegistroAutomotor,
  TipoBaja,
  Usuario
} from "@/types/database";
import CasoCabeceraMobile from "./CasoCabeceraMobile";
import BitacoraTimeline from "./BitacoraTimeline";
import DocumentosMobile from "./DocumentosMobile";

type Tab = "resumen" | "bitacora" | "documentos";

interface Props {
  caso: CasoConRelaciones;
  aseguradoras: Aseguradora[];
  registros: RegistroAutomotor[];
  tiposBaja: TipoBaja[];
  usuarios: Usuario[];
  gestores: Gestor[];
  soloLectura?: boolean;
  esAdministrador?: boolean;
}

function tabDesdeHash(): Tab {
  if (typeof window === "undefined") return "resumen";
  const h = window.location.hash.replace("#", "");
  if (h === "bitacora" || h === "documentos" || h === "resumen") return h;
  return "resumen";
}

export default function CasoDetailMobile(props: Props) {
  const { caso, soloLectura } = props;
  const [tab, setTab] = useState<Tab>("resumen");
  const router = useRouter();

  function volver() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/casos");
    }
  }

  useEffect(() => {
    setTab(tabDesdeHash());
    function onHash() {
      setTab(tabDesdeHash());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "bitacora", label: "Bitácora" },
    { key: "documentos", label: "Documentos" }
  ];

  const estadoAbierto = caso.estado !== "cerrado";

  return (
    <div className="mv -mx-4 px-4" style={{ background: "var(--mv-bg)" }}>
      <div
        className="sticky top-0 z-10 -mx-4 px-4 pt-3"
        style={{ background: "var(--mv-bg)" }}
      >
        <button
          type="button"
          onClick={volver}
          className="flex items-center gap-1 -ml-1 mb-1.5 py-1 pr-2 text-sm"
          style={{ color: "var(--mv-accent-700)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="uppercase leading-tight"
              style={{
                fontFamily: "var(--mv-font-body)",
                fontWeight: 600,
                fontSize: 22,
                letterSpacing: "0.01em",
                fontVariantNumeric: "tabular-nums"
              }}
            >
              {caso.vehiculo?.dominio ?? "—"}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-600)" }}>
              {caso.numero_caso === 0 ? "DEMO" : `N° ${caso.numero_caso}`} · {caso.numero_siniestro}
            </div>
          </div>
          <span className={`mv-badge shrink-0 ${estadoAbierto ? "" : "mv-badge-closed"}`}>
            {ESTADOS.find((e) => e.value === caso.estado)?.label ?? caso.estado}
          </span>
        </div>

        <div className="mv-gradient-line mt-3" />

        <div className="flex" style={{ borderBottom: "1px solid var(--mv-divider)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                window.location.hash = t.key;
              }}
              className="mv-heading flex-1 py-2.5 text-sm"
              style={{
                borderBottom: `2px solid ${tab === t.key ? "var(--mv-accent)" : "transparent"}`,
                color: tab === t.key ? "var(--mv-text)" : "var(--mv-neutral-600)",
                marginBottom: -1
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 pb-4">
        {tab === "resumen" && <CasoCabeceraMobile {...props} />}
        {tab === "bitacora" && (
          <div className="mv-card p-4">
            <BitacoraTimeline casoId={caso.id} soloLectura={soloLectura} />
          </div>
        )}
        {tab === "documentos" && (
          <div className="mv-card p-4">
            <DocumentosMobile casoId={caso.id} soloLectura={soloLectura} />
          </div>
        )}
      </div>
    </div>
  );
}
