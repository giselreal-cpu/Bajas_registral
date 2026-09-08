"use client";

import { useEffect, useState } from "react";
import { CuentaContable, Presupuesto } from "@/types/database";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

function nombreMes(mesKey: string): string {
  const [anio, mes] = mesKey.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric"
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

interface Props {
  cuentas: CuentaContable[];
  esAdministrador: boolean;
}

// Presupuesto vs. real por cuenta contable y mes — solo ARS, mismo
// criterio (devengado, aprobado, no anulado) que "Resumen por cuenta".
// No es por centro de costo/aseguradora, solo por cuenta+mes.
export default function PresupuestoSection({ cuentas, esAdministrador }: Props) {
  const [mes, setMes] = useState(mesActual());
  const [presupuestos, setPresupuestos] = useState<Presupuesto[] | null>(null);
  const [real, setReal] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cuentaId, setCuentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [saving, setSaving] = useState(false);

  const cuentasPresupuestables = cuentas.filter(
    (c) => c.imputable && (c.tipo === "ingreso" || c.tipo === "egreso")
  );

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [resPresupuestos, resReal] = await Promise.all([
        fetch(`/api/presupuestos?mes=${mes}`),
        fetch(`/api/presupuestos/real?mes=${mes}`)
      ]);
      const jsonPresupuestos = await resPresupuestos.json();
      const jsonReal = await resReal.json();
      if (!resPresupuestos.ok) {
        setError(jsonPresupuestos.error);
        return;
      }
      setPresupuestos(jsonPresupuestos.data);
      setReal(jsonReal.data ?? {});
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault();
    if (!cuentaId || !monto) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuenta_contable_id: cuentaId, mes, monto: Number(monto) })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setCuentaId("");
      setMonto("");
      cargar();
    } finally {
      setSaving(false);
    }
  }

  async function borrarPresupuesto(id: string) {
    if (!confirm("¿Borrar este presupuesto?")) return;
    setError(null);
    const res = await fetch(`/api/presupuestos/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    cargar();
  }

  const cuentasConDato = Array.from(
    new Set([
      ...(presupuestos ?? []).map((p) => p.cuenta_contable_id),
      ...Object.keys(real)
    ])
  )
    .map((id) => {
      const p = presupuestos?.find((x) => x.cuenta_contable_id === id);
      const cuenta = p?.cuenta_contable ?? cuentasPresupuestables.find((c) => c.id === id) ?? null;
      const presupuestado = p ? Number(p.monto) : 0;
      const realizado = real[id] ?? 0;
      return { id, presupuestoId: p?.id ?? null, cuenta, presupuestado, realizado };
    })
    .filter((r) => r.cuenta)
    .sort((a, b) => (a.cuenta!.codigo ?? "").localeCompare(b.cuenta!.codigo ?? ""));

  return (
    <div>
      <p className="text-sm text-slate-500 max-w-lg mb-4">
        Presupuesto por cuenta contable y mes, comparado contra lo efectivamente cargado ese mes
        (devengado, aprobado, no anulado, solo pesos) — mismo criterio que &quot;Resumen por
        cuenta&quot;.
      </p>

      <div className="card p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Mes</label>
          <input type="month" className="input" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        <span className="text-sm text-slate-500">{nombreMes(mes)}</span>
      </div>

      {error && <div className="card p-3 mb-4 text-sm text-red-600">{error}</div>}

      {esAdministrador && (
        <form onSubmit={guardarPresupuesto} className="card p-4 mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Cuenta contable</label>
            <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {cuentasPresupuestables.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre} ({c.tipo})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Monto presupuestado</label>
            <input
              type="number"
              step="0.01"
              className="input w-40"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Cuenta</th>
              <th className="px-4 py-2 font-medium text-right">Presupuestado</th>
              <th className="px-4 py-2 font-medium text-right">Real</th>
              <th className="px-4 py-2 font-medium text-right">Diferencia</th>
              <th className="px-4 py-2 font-medium text-right">% ejecutado</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {cuentasConDato.map((r) => {
              const diferencia = r.presupuestado - r.realizado;
              const pct = r.presupuestado > 0 ? Math.round((r.realizado / r.presupuestado) * 100) : null;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <span className="text-slate-500">{r.cuenta!.codigo}</span> · {r.cuenta!.nombre}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.presupuestado > 0 ? formatCurrency(r.presupuestado) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.realizado)}</td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      diferencia < 0 ? "text-red-700" : "text-slate-700"
                    }`}
                  >
                    {r.presupuestado > 0 ? formatCurrency(diferencia) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {pct !== null ? (
                      <span className={pct > 100 ? "text-red-700 font-medium" : ""}>{pct}%</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {esAdministrador && r.presupuestoId && (
                      <button
                        className="text-xs text-slate-400 hover:text-red-600"
                        onClick={() => borrarPresupuesto(r.presupuestoId!)}
                      >
                        Borrar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!cargando && cuentasConDato.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No hay presupuesto ni movimientos cargados para {nombreMes(mes)}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
