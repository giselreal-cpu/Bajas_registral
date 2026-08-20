"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TipoReceptor } from "@/types/database";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

interface Props {
  tipo: TipoReceptor;
  receptorId: string;
  saldoDisponible: number;
}

export default function AnticipoForm({ tipo, receptorId, saldoDisponible }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [monto, setMonto] = useState("");
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!monto) {
      setError("Cargá un monto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/anticipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_receptor: tipo,
          receptor_id: receptorId,
          monto: Number(monto),
          observacion
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setMonto("");
      setObservacion("");
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">
          {saldoDisponible > 0 ? formatCurrency(saldoDisponible) : "—"}
        </span>
        <button
          type="button"
          className="text-brand-600 hover:underline"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? "Cancelar" : "+ Registrar anticipo"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Monto</label>
            <input
              type="number"
              step="0.01"
              className="input w-28"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Observación</label>
            <input
              className="input w-40"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>
          <button className="btn-primary text-xs" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar"}
          </button>
          {error && <p className="text-red-600 w-full">{error}</p>}
        </form>
      )}
    </div>
  );
}
