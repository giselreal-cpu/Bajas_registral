"use client";

import { useEffect, useState } from "react";
import { BitacoraEvento } from "@/types/database";
import { TIPOS_EVENTO, motivoBloqueo } from "@/lib/eventosBitacora";

// Los pasos fijos del timeline móvil son el catálogo real menos
// "Observaciones", que no es un hito de avance sino un registro libre y
// repetible (no tiene sentido como un único punto en una línea de tiempo).
const PASOS = TIPOS_EVENTO.filter((t) => t.value !== "observaciones");

interface Props {
  casoId: string;
  soloLectura?: boolean;
}

export default function BitacoraTimeline({ casoId, soloLectura }: Props) {
  const [eventos, setEventos] = useState<BitacoraEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/casos/${casoId}/bitacora`);
      const json = await res.json();
      if (res.ok) setEventos(json.data);
      else setError(json.error);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function completar(label: string, eventoExistente?: BitacoraEvento) {
    setError(null);
    setSavingLabel(label);
    try {
      const res = eventoExistente
        ? await fetch(`/api/bitacora/${eventoExistente.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completado: true })
          })
        : await fetch(`/api/casos/${casoId}/bitacora`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo_evento: label,
              observacion: "",
              es_interna: false,
              completado: true,
              fecha_inicio: new Date().toISOString().slice(0, 10),
              fecha_fin: null
            })
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      load();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSavingLabel(null);
    }
  }

  if (!eventos) {
    return <p className="text-sm text-slate-500 p-1">Cargando bitácora...</p>;
  }

  const completados = PASOS.filter((p) =>
    eventos.some((ev) => ev.tipo_evento === p.label && ev.completado)
  ).length;

  return (
    <div>
      <p className="text-xs mb-3 tabular-nums" style={{ color: "var(--mv-neutral-600)" }}>
        {completados} de {PASOS.length} eventos completados
      </p>

      {error && (
        <div
          className="mb-3 text-sm rounded-md p-3"
          style={{ color: "var(--mv-accent-700)", background: "var(--mv-accent-100)" }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col">
        {PASOS.map((paso, i) => {
          const ev = eventos.find((e) => e.tipo_evento === paso.label);
          const completado = !!ev?.completado;
          const bloqueo = !completado ? motivoBloqueo(paso.label, eventos) : null;
          const esUltimo = i === PASOS.length - 1;

          return (
            <div key={paso.value} className="flex gap-3">
              <div className="flex flex-col items-center w-[18px] shrink-0">
                <span
                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                  style={
                    completado
                      ? { background: "var(--mv-accent)" }
                      : { background: "#fff", border: "1px solid var(--mv-neutral-400)" }
                  }
                />
                {!esUltimo && (
                  <span className="flex-1 w-px my-1" style={{ background: "var(--mv-divider)" }} />
                )}
              </div>
              <div className={`min-w-0 ${esUltimo ? "pb-1" : "pb-4"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mv-heading text-[15px] tracking-tight">{paso.label}</span>
                  {ev && (
                    <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--mv-neutral-600)" }}>
                      {new Date(ev.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
                {ev?.observacion && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-700)" }}>
                    {ev.observacion}
                  </p>
                )}
                {!completado && !soloLectura && (
                  <div className="mt-1.5 flex items-center gap-2">
                    {bloqueo ? (
                      <span className="text-xs" style={{ color: "var(--mv-neutral-500)" }}>
                        {bloqueo}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={savingLabel === paso.label}
                        onClick={() => completar(paso.label, ev)}
                        className="mv-heading text-xs px-2.5 py-1 rounded-md disabled:opacity-50"
                        style={{ border: "1px solid var(--mv-accent)", color: "var(--mv-accent-700)" }}
                      >
                        {savingLabel === paso.label ? "Guardando..." : "Marcar completado"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
