"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TransferenciaFila {
  id: string;
  fecha: string;
  origen: string;
  destino: string;
  monto: number;
  referencia: string | null;
  anulado: boolean;
  anulado_motivo: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// Pases entre cajas propias (p. ej. depositar efectivo en el banco). No
// son cobros ni pagos: no cambian el resultado ni el Saldo de Cajas total.
export default function TransferenciasInternas({
  mes,
  cajas,
  transferencias,
  bloqueado
}: {
  mes: string;
  cajas: { id: string; nombre: string; moneda: string }[];
  transferencias: TransferenciaFila[];
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [mostrar, setMostrar] = useState(false);
  const [fecha, setFecha] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/transferencias-internas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fecha || `${mes}-01`,
          caja_origen_id: origen,
          caja_destino_id: destino,
          monto: Number(monto),
          referencia
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setMostrar(false);
      setMonto("");
      setReferencia("");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function anular(id: string) {
    const motivo = prompt("Motivo de la anulación:");
    if (motivo === null) return;
    if (!motivo.trim()) {
      setError("La anulación necesita un motivo.");
      return;
    }
    const res = await fetch(`/api/transferencias-internas/${id}`, {
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
  }

  return (
    <div>
      {!bloqueado && (
        <button type="button" className="btn-secondary text-xs mb-3" onClick={() => setMostrar((s) => !s)}>
          {mostrar ? "Cancelar" : "+ Nueva transferencia"}
        </button>
      )}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {mostrar && (
        <form onSubmit={guardar} className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="label">Desde caja</label>
            <select required className="input w-52" value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="">Elegir...</option>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Hacia caja</label>
            <select required className="input w-52" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Elegir...</option>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Monto</label>
            <input
              required
              type="number"
              step="0.01"
              className="input w-32"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Referencia</label>
            <input className="input w-48" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <button className="btn-primary text-xs" disabled={guardando} type="submit">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      {transferencias.length === 0 ? (
        <p className="text-sm text-slate-400">No hay transferencias internas en este mes.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Fecha</th>
              <th className="py-1 pr-3 font-medium">Desde</th>
              <th className="py-1 pr-3 font-medium">Hacia</th>
              <th className="py-1 pr-3 font-medium text-right">Monto</th>
              <th className="py-1 pr-3 font-medium">Referencia</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transferencias.map((t) => (
              <tr key={t.id} className={`border-t border-slate-100 ${t.anulado ? "text-slate-400 line-through" : ""}`}>
                <td className="py-1.5 pr-3">{new Date(t.fecha + "T00:00:00").toLocaleDateString("es-AR")}</td>
                <td className="py-1.5 pr-3">{t.origen}</td>
                <td className="py-1.5 pr-3">{t.destino}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(t.monto)}</td>
                <td className="py-1.5 pr-3">{t.referencia ?? "—"}</td>
                <td className="py-1.5 text-right no-underline">
                  {t.anulado ? (
                    <span className="text-xs text-red-600 no-underline">Anulada{t.anulado_motivo ? ` — ${t.anulado_motivo}` : ""}</span>
                  ) : (
                    !bloqueado && (
                      <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => anular(t.id)}>
                        Anular
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
