"use client";

import { useState } from "react";
import { normalizarEmails } from "@/lib/email/notificacionesCaso";

interface Vista {
  destinatarios: string[];
  subject: string;
  text: string;
}

// Envía por mail al productor (a los mails cargados en "Contacto de productor")
// un seguimiento del caso: estado, avance y deudas. Se ve una vista previa
// antes de enviar; la última observación de la bitácora es opcional.
export default function SeguimientoProductor({
  casoId,
  productorContacto,
  anulado,
  soloLectura,
  mobile
}: {
  casoId: string;
  productorContacto?: string | null;
  anulado?: boolean;
  soloLectura?: boolean;
  mobile?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista | null>(null);
  const [observacion, setObservacion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string[] | null>(null);

  if (soloLectura || anulado || normalizarEmails(productorContacto).length === 0) return null;

  async function cargar(conObservacion: boolean) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/seguimiento-productor${conObservacion ? "?observacion=1" : ""}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo armar el seguimiento.");
        return;
      }
      setVista(json as Vista);
    } finally {
      setCargando(false);
    }
  }

  async function abrir() {
    setAbierto(true);
    setEnviado(null);
    setObservacion(false);
    await cargar(false);
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/seguimiento-productor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacion })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo enviar el mail.");
        return;
      }
      setEnviado(json.destinatarios ?? []);
      setAbierto(false);
      setVista(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mb-4">
      {enviado && (
        <p className="mb-2 text-sm text-green-700">Seguimiento enviado a {enviado.join(", ")}.</p>
      )}
      {!abierto ? (
        <button
          type="button"
          onClick={abrir}
          className={mobile ? "mv-btn mv-btn-secondary text-xs px-3 py-1.5" : "btn-secondary text-sm"}
        >
          Enviar seguimiento al productor
        </button>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
          {cargando && !vista && <p className="text-slate-500">Armando el seguimiento...</p>}
          {vista && (
            <>
              <p className="text-slate-600">
                Se envía a: <span className="font-medium">{vista.destinatarios.join(", ")}</span>
              </p>
              <p className="text-slate-600">
                Asunto: <span className="font-medium">{vista.subject}</span>
              </p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-700 font-sans">
                {vista.text}
              </pre>
              <label className="flex items-start gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={observacion}
                  disabled={cargando}
                  onChange={(e) => {
                    setObservacion(e.target.checked);
                    cargar(e.target.checked);
                  }}
                />
                <span>
                  Incluir la última observación de la bitácora (las observaciones internas nunca se incluyen).
                  Revisala antes de enviar: puede ser sensible para el productor.
                </span>
              </label>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={enviando || cargando || !vista}
              onClick={enviar}
              className={mobile ? "mv-btn mv-btn-primary text-xs px-3 py-1.5" : "btn-primary text-xs"}
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setVista(null);
                setError(null);
              }}
              className={mobile ? "text-xs" : "btn-secondary text-xs"}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
