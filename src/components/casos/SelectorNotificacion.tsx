"use client";

import { useState } from "react";
import { CasoConRelaciones } from "@/types/database";
import {
  DESTINATARIOS,
  Destinatario,
  TipoNotificacion,
  destinatariosDisponibles
} from "@/lib/email/notificacionesCaso";

interface Resultado {
  enviados: string[];
  fallidos: { destinatario: string; error: string }[];
}

export default function SelectorNotificacion({
  casoId,
  caso,
  tipo,
  onClose
}: {
  casoId: string;
  caso: CasoConRelaciones;
  tipo: TipoNotificacion;
  onClose?: () => void;
}) {
  const disponibles = destinatariosDisponibles(caso);
  const [seleccionados, setSeleccionados] = useState<Set<Destinatario>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function toggle(d: Destinatario) {
    setSeleccionados((s) => {
      const next = new Set(s);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/notificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, destinatarios: Array.from(seleccionados) })
      });
      const json = await res.json();
      setResultado(json);
    } finally {
      setEnviando(false);
    }
  }

  const labelDestinatario = (d: string) => DESTINATARIOS.find((x) => x.value === d)?.label ?? d;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-slate-500">Notificar por mail a:</p>
        {onClose && (
          <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={onClose}>
            Ocultar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        {DESTINATARIOS.map((d) => {
          const email = disponibles[d.value];
          return (
            <label
              key={d.value}
              className={`flex items-center gap-2 ${email ? "text-slate-700" : "text-slate-400"}`}
            >
              <input
                type="checkbox"
                disabled={!email}
                checked={seleccionados.has(d.value)}
                onChange={() => toggle(d.value)}
              />
              {d.label}
              {email ? ` (${email})` : " (sin mail cargado)"}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className="btn-secondary text-xs"
        disabled={enviando || seleccionados.size === 0}
        onClick={enviar}
      >
        {enviando ? "Enviando..." : "Enviar notificación"}
      </button>
      {resultado && (
        <div className="text-xs space-y-1">
          {resultado.enviados.length > 0 && (
            <p className="text-emerald-700">
              Enviado a: {resultado.enviados.map(labelDestinatario).join(", ")}
            </p>
          )}
          {resultado.fallidos.length > 0 && (
            <p className="text-red-600">
              No se pudo enviar a:{" "}
              {resultado.fallidos
                .map((f) => `${labelDestinatario(f.destinatario)} (${f.error})`)
                .join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
