"use client";

import { useEffect, useState } from "react";
import piezasJson from "@/lib/piezasRudac.json";
import { TIPOS_VEHICULO } from "@/types/database";
import type { PiezaRudac } from "@/lib/anexo04";

const PIEZAS = piezasJson as PiezaRudac[];

type Decision = "SI" | "NO" | "DEPENDE";
type Regla = { codigo: string; tipo_vehiculo: string; decision: Decision };

const OPCIONES: { value: Decision; label: string; claseActiva: string }[] = [
  { value: "SI", label: "SI", claseActiva: "bg-emerald-600 text-white" },
  { value: "NO", label: "NO", claseActiva: "bg-red-600 text-white" },
  { value: "DEPENDE", label: "?", claseActiva: "bg-amber-500 text-white" }
];

export default function ReglasPiezasMatrix() {
  const [reglas, setReglas] = useState<Map<string, Decision> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reglas-piezas-rudac")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          return;
        }
        const mapa = new Map<string, Decision>();
        for (const r of json.data as Regla[]) {
          mapa.set(`${r.codigo}::${r.tipo_vehiculo}`, r.decision);
        }
        setReglas(mapa);
      })
      .catch(() => setError("No se pudo conectar con el servidor."));
  }, []);

  async function elegir(codigo: string, tipoVehiculo: string, decision: Decision) {
    const clave = `${codigo}::${tipoVehiculo}`;
    const anterior = reglas?.get(clave);
    setReglas((m) => new Map(m).set(clave, decision));
    setGuardando(clave);

    const res = await fetch("/api/reglas-piezas-rudac", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, tipo_vehiculo: tipoVehiculo, decision })
    });

    setGuardando(null);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "No se pudo guardar.");
      setReglas((m) => {
        const nuevo = new Map(m);
        if (anterior) nuevo.set(clave, anterior);
        else nuevo.delete(clave);
        return nuevo;
      });
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!reglas) {
    return <p className="text-sm text-slate-500">Cargando...</p>;
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="max-h-[75vh] overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-slate-200">
              <th className="text-left px-3 py-2 font-medium text-slate-600 sticky left-0 bg-white">
                Pieza
              </th>
              {TIPOS_VEHICULO.map((t) => (
                <th key={t} className="px-2 py-2 font-medium text-slate-600 text-center whitespace-nowrap">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PIEZAS.map((p) => (
              <tr key={p.codigo} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 sticky left-0 bg-white">
                  <div className="text-slate-800">{p.descripcion}</div>
                  <div className="text-xs text-slate-400">
                    #{p.codigo} · {p.categoria}
                    {p.requierePerito ? " · requiere perito" : ""}
                  </div>
                </td>
                {TIPOS_VEHICULO.map((t) => {
                  const clave = `${p.codigo}::${t}`;
                  const actual = reglas.get(clave) ?? "DEPENDE";
                  return (
                    <td key={t} className="px-2 py-1.5">
                      <div className="flex justify-center gap-1">
                        {OPCIONES.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            disabled={guardando === clave}
                            onClick={() => elegir(p.codigo, t, o.value)}
                            className={`w-7 h-6 rounded text-xs font-medium border ${
                              actual === o.value
                                ? `${o.claseActiva} border-transparent`
                                : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
