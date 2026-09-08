"use client";

import { useEffect, useState } from "react";
import { CierreMensual } from "@/types/database";

function nombreMes(mesKey: string): string {
  const [anio, mes] = mesKey.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric"
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

interface Props {
  esAdministrador: boolean;
}

// Cierre de período (manual, por mes): una vez cerrado, ningún
// movimiento financiero con fecha dentro de ese mes se puede crear,
// editar, anular ni borrar hasta reabrirlo — ver
// 0051_cierres_mensuales.sql. Reservado a administrador.
export default function CierresMensualesSection({ esAdministrador }: Props) {
  const [cierres, setCierres] = useState<CierreMensual[] | null>(null);
  const [mes, setMes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/cierres-mensuales");
    const json = await res.json();
    if (res.ok) setCierres(json.data);
    else setError(json.error);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cerrarPeriodo(e: React.FormEvent) {
    e.preventDefault();
    if (!mes) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cierres-mensuales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setMes("");
      cargar();
    } finally {
      setSaving(false);
    }
  }

  async function reabrirPeriodo(mesCerrado: string) {
    if (!confirm(`¿Reabrir ${nombreMes(mesCerrado)}? Vuelve a permitir cargar y modificar movimientos con esa fecha.`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/cierres-mensuales/${mesCerrado}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    cargar();
  }

  return (
    <div>
      <p className="text-sm text-slate-500 max-w-lg mb-4">
        Un mes cerrado bloquea crear, editar, anular o borrar cualquier movimiento (por caso,
        general, cobro, nota de crédito o factura) con fecha dentro de ese período — incluso para
        un administrador, hasta reabrirlo.
      </p>

      {error && <div className="card p-3 mb-4 text-sm text-red-600">{error}</div>}

      {esAdministrador && (
        <form onSubmit={cerrarPeriodo} className="card p-4 mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Mes a cerrar</label>
            <input
              type="month"
              required
              className="input"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Cerrando..." : "Cerrar período"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Período</th>
              <th className="px-4 py-2 font-medium">Cerrado por</th>
              <th className="px-4 py-2 font-medium">Fecha de cierre</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(cierres ?? []).map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{nombreMes(c.mes)}</td>
                <td className="px-4 py-2 text-slate-600">{c.cerrado_por_usuario?.nombre ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(c.cerrado_at).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-2 text-right">
                  {esAdministrador && (
                    <button
                      className="text-xs text-slate-400 hover:text-brand-700"
                      onClick={() => reabrirPeriodo(c.mes)}
                    >
                      Reabrir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {cierres !== null && cierres.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Todavía no se cerró ningún período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
