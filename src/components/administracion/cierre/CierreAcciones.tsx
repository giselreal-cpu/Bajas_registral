"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Cerrar y reabrir el mes: solo administrador. Cerrar exige haber cargado
// el saldo real de cada caja activa (lo valida el servidor); reabrir exige
// un motivo, que queda en el historial junto con el snapshot anterior.
export default function CierreAcciones({
  mes,
  cerrado,
  esAdministrador
}: {
  mes: string;
  cerrado: boolean;
  esAdministrador: boolean;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!esAdministrador) {
    return (
      <p className="text-sm text-slate-500">
        {cerrado ? "Mes cerrado." : "Solo un administrador puede cerrar el mes."}
      </p>
    );
  }

  async function cerrar() {
    if (!confirm(`¿Cerrar ${mes}? Se congela el reporte y no se podrán cargar ni modificar movimientos de ese mes.`)) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cierre-mensual/${mes}/cerrar`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function reabrir() {
    const motivo = prompt(`Motivo para reabrir ${mes}:`);
    if (motivo === null) return;
    if (!motivo.trim()) {
      setError("La reapertura necesita un motivo.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cierres-mensuales/${mes}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      {cerrado ? (
        <button type="button" className="btn-secondary" disabled={guardando} onClick={reabrir}>
          {guardando ? "Reabriendo..." : "Reabrir mes"}
        </button>
      ) : (
        <button type="button" className="btn-primary" disabled={guardando} onClick={cerrar}>
          {guardando ? "Cerrando..." : "Cerrar mes"}
        </button>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
