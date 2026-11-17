"use client";

import { useState } from "react";
import { normalizarEmails } from "@/lib/email/notificacionesCaso";
import { DatosSeguimiento, mailSeguimiento } from "@/lib/seguimientoProductor";

interface Datos {
  destinatarios: string[];
  datos: DatosSeguimiento;
  ultimaObservacion: string | null;
  hayObservaciones: boolean;
}

// Envía por mail al productor (a los mails cargados en "Contacto de productor")
// un seguimiento del caso: estado, avance y deudas. Se ve una vista previa
// antes de enviar. La "novedad" es opcional y siempre pasa por una persona:
// se escribe a mano, se toma la última observación o se pide un borrador a la
// IA que hay que revisar (y tildar como revisado) antes de poder enviar.
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
  const [info, setInfo] = useState<Datos | null>(null);
  const [novedad, setNovedad] = useState("");
  const [deIa, setDeIa] = useState(false); // la novedad empezó como borrador de la IA
  const [revisada, setRevisada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string[] | null>(null);

  if (soloLectura || anulado || normalizarEmails(productorContacto).length === 0) return null;

  async function abrir() {
    setAbierto(true);
    setEnviado(null);
    setNovedad("");
    setDeIa(false);
    setRevisada(false);
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const res = await fetch(`/api/casos/${casoId}/seguimiento-productor`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo armar el seguimiento.");
        return;
      }
      setInfo(json as Datos);
    } finally {
      setCargando(false);
    }
  }

  async function sugerirConIa() {
    setGenerando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/seguimiento-productor/novedad`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo generar el borrador.");
        return;
      }
      if (!json.borrador) {
        setAviso(json.aviso ?? "La IA no encontró nada para contar.");
        return;
      }
      setNovedad(json.borrador);
      setDeIa(true);
      setRevisada(false);
    } finally {
      setGenerando(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/seguimiento-productor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novedad })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo enviar el mail.");
        return;
      }
      setEnviado(json.destinatarios ?? []);
      setAbierto(false);
      setInfo(null);
    } finally {
      setEnviando(false);
    }
  }

  const mail = info ? mailSeguimiento(info.datos, { novedad }) : null;
  const falta = deIa && novedad.trim() !== "" && !revisada;
  const btnSec = mobile ? "mv-btn mv-btn-secondary text-xs px-3 py-1.5" : "btn-secondary text-xs";

  return (
    <div className="mb-4">
      {enviado && <p className="mb-2 text-sm text-green-700">Seguimiento enviado a {enviado.join(", ")}.</p>}
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
          {cargando && !info && <p className="text-slate-500">Armando el seguimiento...</p>}
          {info && mail && (
            <>
              <p className="text-slate-600">
                Se envía a: <span className="font-medium">{info.destinatarios.join(", ")}</span>
              </p>
              <p className="text-slate-600">
                Asunto: <span className="font-medium">{mail.subject}</span>
              </p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-700 font-sans">
                {mail.text}
              </pre>

              <div className="space-y-1.5">
                <p className="font-medium text-slate-700">Novedad (opcional)</p>
                <p className="text-xs text-slate-500">
                  Es un tema sensible para el productor: se agrega solo lo que vos aprobás. Las observaciones
                  internas nunca se usan.
                </p>
                <textarea
                  className={mobile ? "mv-input" : "input"}
                  rows={3}
                  maxLength={2000}
                  placeholder="Escribí una novedad, o usá una de las opciones de abajo."
                  value={novedad}
                  onChange={(e) => setNovedad(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {info.hayObservaciones && (
                    <button type="button" className={btnSec} disabled={generando} onClick={sugerirConIa}>
                      {generando ? "Redactando..." : "Sugerir con IA"}
                    </button>
                  )}
                  {info.ultimaObservacion && (
                    <button
                      type="button"
                      className={btnSec}
                      onClick={() => {
                        setNovedad(info.ultimaObservacion ?? "");
                        setDeIa(false);
                        setAviso(null);
                      }}
                    >
                      Usar la última observación tal cual
                    </button>
                  )}
                  {novedad && (
                    <button
                      type="button"
                      className="text-xs underline text-slate-500"
                      onClick={() => {
                        setNovedad("");
                        setDeIa(false);
                      }}
                    >
                      Quitar novedad
                    </button>
                  )}
                </div>
                {aviso && <p className="text-xs text-slate-500">{aviso}</p>}
                {deIa && novedad.trim() !== "" && (
                  <label className="flex items-start gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={revisada}
                      onChange={(e) => setRevisada(e.target.checked)}
                    />
                    <span>
                      Borrador redactado por IA: lo revisé, lo corregí si hacía falta y lo apruebo para enviarlo al
                      productor.
                    </span>
                  </label>
                )}
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={enviando || cargando || !info || falta}
              onClick={enviar}
              className={mobile ? "mv-btn mv-btn-primary text-xs px-3 py-1.5" : "btn-primary text-xs"}
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setInfo(null);
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
