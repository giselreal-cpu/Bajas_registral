"use client";

import { useEffect, useState } from "react";
import { HistorialCambio } from "@/types/database";

export default function HistorialSection({
  casoId,
  soloLectura
}: {
  casoId: string;
  soloLectura?: boolean;
}) {
  const [historial, setHistorial] = useState<HistorialCambio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El historial es de auditoría interna: no tiene sentido mostrárselo
    // al rol "compañía" (que además no tendría acceso vía RLS de todas
    // formas, esto solo evita el pedido de más).
    if (soloLectura) return;

    fetch(`/api/casos/${casoId}/historial`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setHistorial(json.data);
        else setError(json.error);
      })
      .catch(() => setError("No se pudo conectar con el servidor."));
  }, [casoId, soloLectura]);

  if (soloLectura) return null;

  return (
    <section className="card p-4">
      <h2 className="font-medium text-slate-800 mb-3">Historial de cambios</h2>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
        {historial?.map((h) => (
          <li key={h.id} className="border border-slate-100 rounded-lg p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-slate-800">{h.tipo_cambio}</p>
                {h.detalle && <p className="text-xs text-slate-500">{h.detalle}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-slate-600">
                  {h.usuario?.nombre ?? "Sistema"}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(h.created_at).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
            </div>
          </li>
        ))}
        {historial?.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay cambios registrados.</p>
        )}
        {historial === null && !error && (
          <p className="text-sm text-slate-400">Cargando...</p>
        )}
      </ul>
    </section>
  );
}
