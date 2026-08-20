"use client";

import { useEffect, useState } from "react";
import { Aseguradora, BaseCalculoCompania, ComercialAseguradora } from "@/types/database";

export default function ComercialAseguradoraSection() {
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [aseguradoraId, setAseguradoraId] = useState("");
  const [config, setConfig] = useState<Partial<ComercialAseguradora>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    fetch("/api/aseguradoras")
      .then((r) => r.json())
      .then((j) => setAseguradoras(j.data ?? []));
  }, []);

  useEffect(() => {
    if (!aseguradoraId) {
      setConfig({});
      return;
    }
    setError(null);
    fetch(`/api/aseguradoras/${aseguradoraId}/comercial`)
      .then((r) => r.json())
      .then((j) => setConfig(j.data ?? {}));
  }, [aseguradoraId]);

  async function handleGuardar() {
    if (!aseguradoraId) return;
    setSaving(true);
    setError(null);
    setGuardado(false);
    try {
      const res = await fetch(`/api/aseguradoras/${aseguradoraId}/comercial`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          porcentaje_desarmadero: config.porcentaje_desarmadero ?? null,
          porcentaje_compania: config.porcentaje_compania ?? null,
          base_calculo_compania: config.base_calculo_compania ?? null
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-4 mt-6">
      <h2 className="font-medium text-slate-800 mb-1">Configuración comercial</h2>
      <p className="text-sm text-slate-500 mb-4">
        Porcentajes que usa el módulo de rentabilidad para sugerir montos de
        cobro/pago por caso. Solo visible para operador/administrador.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="mb-4">
        <label className="label">Aseguradora</label>
        <select
          className="input max-w-sm"
          value={aseguradoraId}
          onChange={(e) => setAseguradoraId(e.target.value)}
        >
          <option value="">Elegí una aseguradora...</option>
          {aseguradoras.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      {aseguradoraId && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">% al desarmadero (sobre Valor InfoAuto)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={config.porcentaje_desarmadero ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    porcentaje_desarmadero: e.target.value === "" ? null : Number(e.target.value)
                  }))
                }
              />
            </div>
            <div>
              <label className="label">% a la compañía</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={config.porcentaje_compania ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    porcentaje_compania: e.target.value === "" ? null : Number(e.target.value)
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Base de cálculo (pago a la compañía)</label>
              <select
                className="input"
                value={config.base_calculo_compania ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    base_calculo_compania: (e.target.value || null) as BaseCalculoCompania | null
                  }))
                }
              >
                <option value="">Sin definir</option>
                <option value="valor_infoauto">Valor InfoAuto</option>
                <option value="suma_asegurada">Suma asegurada</option>
              </select>
            </div>
          </div>
          <button className="btn-primary" disabled={saving} onClick={handleGuardar}>
            {saving ? "Guardando..." : guardado ? "¡Guardado!" : "Guardar configuración"}
          </button>
        </div>
      )}
    </section>
  );
}
