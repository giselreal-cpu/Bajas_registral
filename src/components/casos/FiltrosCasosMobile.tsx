"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ESTADOS } from "@/types/database";

interface Opcion {
  id: string;
  nombre: string;
}

interface Props {
  aseguradoras: Opcion[];
  tiposBaja: Opcion[];
  buscar: string;
  aseguradoraId: string;
  tipoBajaId: string;
  estado: string;
}

type FiltroKey = "aseguradora_id" | "tipo_baja_id" | "estado";

export default function FiltrosCasosMobile({
  aseguradoras,
  tiposBaja,
  buscar,
  aseguradoraId,
  tipoBajaId,
  estado
}: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState(buscar);
  const [picker, setPicker] = useState<FiltroKey | null>(null);

  function navegar(overrides: Partial<Record<FiltroKey | "buscar", string>>) {
    const valores = {
      buscar: overrides.buscar ?? texto,
      aseguradora_id: overrides.aseguradora_id ?? aseguradoraId,
      tipo_baja_id: overrides.tipo_baja_id ?? tipoBajaId,
      estado: overrides.estado ?? estado
    };
    const params = new URLSearchParams();
    Object.entries(valores).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/casos?${params.toString()}`);
  }

  const filtros: {
    key: FiltroKey;
    label: string;
    valor: string;
    opciones: Opcion[] | { value: string; label: string }[];
  }[] = [
    { key: "tipo_baja_id", label: "Tipo de baja", valor: tipoBajaId, opciones: tiposBaja },
    { key: "aseguradora_id", label: "Compañía", valor: aseguradoraId, opciones: aseguradoras },
    { key: "estado", label: "Estado", valor: estado, opciones: ESTADOS }
  ];

  function etiquetaDe(f: (typeof filtros)[number]): string {
    if (!f.valor) return f.label;
    const match = f.opciones.find((o) => ("id" in o ? o.id : o.value) === f.valor);
    return match ? ("nombre" in match ? match.nombre : match.label) : f.label;
  }

  const pickerDef = filtros.find((f) => f.key === picker);

  return (
    <div className="mb-4">
      <div
        className="flex items-center gap-2 rounded-md bg-white px-3 mb-3"
        style={{ border: "1px solid var(--mv-divider)", height: 46 }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--mv-neutral-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          placeholder="Dominio, N° de siniestro o asegurado"
          className="flex-1 border-0 outline-none bg-transparent text-sm"
          style={{ fontFamily: "var(--mv-font-body)", color: "var(--mv-text)" }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navegar({ buscar: texto });
          }}
          onBlur={() => navegar({ buscar: texto })}
        />
      </div>

      <div className="flex gap-2 overflow-auto pb-1">
        {filtros.map((f) => {
          const activo = !!f.valor;
          return (
            <span
              key={f.key}
              className="shrink-0 inline-flex items-center rounded-full"
              style={
                activo
                  ? {
                      background: "rgba(182,130,53,0.14)",
                      border: "1px solid var(--mv-accent)",
                      color: "var(--mv-accent-700)"
                    }
                  : {
                      border: "1px solid var(--mv-divider)",
                      color: "var(--mv-neutral-700)"
                    }
              }
            >
              <button
                type="button"
                onClick={() => setPicker(f.key)}
                className="mv-heading inline-flex items-center gap-1.5 text-[13px]"
                style={{ minHeight: 34, padding: activo ? "7px 4px 7px 13px" : "7px 13px" }}
              >
                {etiquetaDe(f)}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {activo && (
                <button
                  type="button"
                  aria-label="Quitar filtro"
                  onClick={() => navegar({ [f.key]: "" })}
                  className="inline-flex items-center justify-center"
                  style={{ width: 32, minHeight: 34, padding: "0 10px 0 4px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </span>
          );
        })}
      </div>

      {pickerDef && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0" style={{ background: "rgba(32,31,29,0.45)" }} onClick={() => setPicker(null)} />
          <div
            className="absolute left-0 right-0 bottom-0 p-4 pb-6 max-h-[78%] overflow-auto"
            style={{
              background: "var(--mv-bg)",
              borderTop: "1px solid var(--mv-divider)",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 12px 32px rgba(45,43,43,0.22)"
            }}
          >
            <div className="w-[38px] h-[3px] rounded-full mx-auto mb-3.5" style={{ background: "var(--mv-neutral-400)" }} />
            <h4 className="mv-heading text-lg mb-3">{pickerDef.label}</h4>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  navegar({ [pickerDef.key]: "" });
                  setPicker(null);
                }}
                className="flex items-center justify-between gap-3 w-full text-left py-3 text-[14.5px]"
                style={{ borderBottom: "1px solid var(--mv-divider)", minHeight: 48 }}
              >
                Todos
                {!pickerDef.valor && (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--mv-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
              {pickerDef.opciones.map((o) => {
                const value = "id" in o ? o.id : o.value;
                const label = "nombre" in o ? o.nombre : o.label;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      navegar({ [pickerDef.key]: value });
                      setPicker(null);
                    }}
                    className="flex items-center justify-between gap-3 w-full text-left py-3 text-[14.5px]"
                    style={{ borderBottom: "1px solid var(--mv-divider)", minHeight: 48 }}
                  >
                    {label}
                    {pickerDef.valor === value && (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--mv-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
