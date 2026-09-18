"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_VEHICULO } from "@/types/database";
import {
  guardarTipoVehiculoDesarmadero,
  guardarDecisionPiezaDesarmadero,
  generarAnexo04Desarmadero
} from "./actions";

interface Pieza {
  codigo: string;
  descripcion: string;
  categoria: "APC" | "C";
  requierePerito: boolean;
  decision: "SI" | "NO" | null;
}

const OPCIONES: { value: "SI" | "NO" | null; label: string; claseActiva: string }[] = [
  { value: "SI", label: "SI", claseActiva: "bg-emerald-600 text-white" },
  { value: "NO", label: "NO", claseActiva: "bg-red-600 text-white" },
  { value: null, label: "?", claseActiva: "bg-amber-500 text-white" }
];

export default function Anexo04Form({
  token,
  tipoVehiculo,
  piezas
}: {
  token: string;
  tipoVehiculo: string | null;
  piezas: Pieza[];
}) {
  const router = useRouter();
  const [tipoElegido, setTipoElegido] = useState(tipoVehiculo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const [guardandoCodigo, setGuardandoCodigo] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  async function guardarTipo() {
    if (!tipoElegido) return;
    setGuardandoTipo(true);
    setError(null);
    const resultado = await guardarTipoVehiculoDesarmadero(token, tipoElegido);
    setGuardandoTipo(false);
    if (resultado.error) setError(resultado.error);
    else router.refresh();
  }

  async function elegirDecision(codigo: string, decision: "SI" | "NO" | null) {
    setGuardandoCodigo(codigo);
    setError(null);
    const resultado = await guardarDecisionPiezaDesarmadero(token, codigo, decision);
    setGuardandoCodigo(null);
    if (resultado.error) setError(resultado.error);
    else router.refresh();
  }

  async function generar() {
    setGenerando(true);
    setError(null);
    const resultado = await generarAnexo04Desarmadero(token);
    setGenerando(false);
    if (resultado.error) setError(resultado.error);
    else router.refresh();
  }

  return (
    <section className="card p-4 space-y-4">
      <div>
        <h2 className="font-medium text-slate-800">Anexo 04 (Piezas RUDAC)</h2>
        <p className="text-sm text-slate-500">
          Marcá qué piezas se autoriza a desarmar. Podés editarlo las veces que necesites y volver
          a generar el PDF.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <label className="label">Tipo de vehículo</label>
          <select
            className="input"
            value={tipoElegido}
            onChange={(e) => setTipoElegido(e.target.value)}
          >
            <option value="">Sin elegir</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!tipoElegido || guardandoTipo}
          onClick={guardarTipo}
        >
          {guardandoTipo ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!tipoVehiculo ? (
        <p className="text-sm text-slate-400">Elegí el tipo de vehículo para ver el checklist.</p>
      ) : (
        <>
          <div className="max-h-[60vh] overflow-auto -mx-4 px-4">
            <ul className="divide-y divide-slate-100">
              {piezas.map((p) => (
                <li
                  key={p.codigo}
                  className={`py-2 flex items-center justify-between gap-3 ${
                    p.decision === null ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-slate-800">{p.descripcion}</div>
                    <div className="text-xs text-slate-400">
                      #{p.codigo} · {p.categoria}
                      {p.requierePerito ? " · requiere perito" : ""}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {OPCIONES.map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        disabled={guardandoCodigo === p.codigo}
                        onClick={() => elegirDecision(p.codigo, o.value)}
                        className={`w-8 h-7 rounded text-xs font-medium border ${
                          p.decision === o.value
                            ? `${o.claseActiva} border-transparent`
                            : "bg-white text-slate-400 border-slate-200"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button type="button" className="btn-primary w-full" disabled={generando} onClick={generar}>
            {generando ? "Generando..." : "Generar Anexo 04"}
          </button>
        </>
      )}
    </section>
  );
}
