"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export interface PuntoComparativo {
  mes: string;
  ganancia: number;
  roi: number | null;
  saldo: number;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
}

function millones(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} mil`;
  return String(v);
}

function pesos(v: number): string {
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// Dos gráficos del comparativo de 12 meses: ganancia (barras) con el ROI
// (línea, eje derecho) y la evolución del Saldo de Cajas.
export default function ComparativoGraficos({ puntos }: { puntos: PuntoComparativo[] }) {
  const datos = puntos.map((p) => ({ ...p, etiqueta: etiquetaMes(p.mes), roiGrafico: p.roi }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Ganancia y ROI</h3>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="izq" tickFormatter={millones} tick={{ fontSize: 11 }} width={56} />
              <YAxis
                yAxisId="der"
                orientation="right"
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11 }}
                width={50}
              />
              <Tooltip
                formatter={(valor, nombre) =>
                  nombre === "ROI %"
                    ? [valor === null || valor === undefined ? "N/A" : `${valor} %`, nombre]
                    : [pesos(Number(valor)), nombre]
                }
              />
              <Legend />
              <ReferenceLine yAxisId="izq" y={0} stroke="#94a3b8" />
              <Bar yAxisId="izq" dataKey="ganancia" name="Ganancia" fill="#2f6f4f" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="der"
                type="monotone"
                dataKey="roiGrafico"
                name="ROI %"
                stroke="#b68235"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Saldo de Cajas</h3>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={millones} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={(valor) => [pesos(Number(valor)), "Saldo de cajas"]} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Line type="monotone" dataKey="saldo" name="Saldo de cajas" stroke="#1f3a5f" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
