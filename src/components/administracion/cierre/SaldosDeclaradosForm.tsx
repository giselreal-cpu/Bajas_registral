"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface FilaConciliacion {
  caja_id: string;
  nombre: string;
  grupo: "bancos" | "efectivo";
  moneda: string;
  saldo_inicial_periodo: number;
  entradas: number;
  salidas: number;
  saldo_calculado: number;
  saldo_declarado: number | null;
  tipo_declarado: "extracto" | "arqueo" | null;
  diferencia: number | null;
  tipo_esperado: "extracto" | "arqueo";
}

function formatear(valor: number, moneda: string): string {
  return valor.toLocaleString("es-AR", { style: "currency", currency: moneda === "USD" ? "USD" : "ARS" });
}

// Conciliación por caja: saldo calculado por el sistema vs. saldo REAL
// que se declara (extracto bancario / arqueo físico). Cualquier diferencia
// distinta de 0 se marca; en efectivo se lee como faltante/sobrante.
export default function SaldosDeclaradosForm({
  mes,
  filas,
  bloqueado
}: {
  mes: string;
  filas: FilaConciliacion[];
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(filas.map((f) => [f.caja_id, f.saldo_declarado === null ? "" : String(f.saldo_declarado)]))
  );
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cajaId: string) {
    setGuardando(cajaId);
    setError(null);
    try {
      const res = await fetch(`/api/cierre-mensual/${mes}/saldos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caja_id: cajaId, saldo_declarado: valores[cajaId] })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      router.refresh();
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Caja</th>
              <th className="py-1 pr-3 font-medium text-right">Saldo inicial</th>
              <th className="py-1 pr-3 font-medium text-right">Entradas</th>
              <th className="py-1 pr-3 font-medium text-right">Salidas</th>
              <th className="py-1 pr-3 font-medium text-right">Calculado</th>
              <th className="py-1 pr-3 font-medium">Real declarado</th>
              <th className="py-1 pr-3 font-medium text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.caja_id} className="border-t border-slate-100">
                <td className="py-1.5 pr-3">
                  {f.nombre}
                  <span className="block text-xs text-slate-400">
                    {f.grupo === "bancos" ? "Banco" : "Efectivo"} · {f.moneda}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatear(f.saldo_inicial_periodo, f.moneda)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatear(f.entradas, f.moneda)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatear(f.salidas, f.moneda)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{formatear(f.saldo_calculado, f.moneda)}</td>
                <td className="py-1.5 pr-3">
                  {bloqueado ? (
                    <span className="tabular-nums">
                      {f.saldo_declarado === null ? "—" : formatear(f.saldo_declarado, f.moneda)}
                      {f.tipo_declarado && <span className="text-xs text-slate-400"> ({f.tipo_declarado})</span>}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        className="input w-36"
                        placeholder={f.tipo_esperado === "extracto" ? "Extracto" : "Arqueo"}
                        value={valores[f.caja_id] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [f.caja_id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={guardando === f.caja_id || (valores[f.caja_id] ?? "") === ""}
                        onClick={() => guardar(f.caja_id)}
                      >
                        {guardando === f.caja_id ? "..." : "Guardar"}
                      </button>
                    </div>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {f.diferencia === null ? (
                    <span className="text-slate-400">—</span>
                  ) : f.diferencia === 0 ? (
                    <span className="text-emerald-700">OK</span>
                  ) : (
                    <span className="text-red-600 font-medium">
                      {formatear(f.diferencia, f.moneda)}
                      {f.tipo_declarado === "arqueo" && (
                        <span className="block text-xs">{f.diferencia < 0 ? "faltante" : "sobrante"}</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
