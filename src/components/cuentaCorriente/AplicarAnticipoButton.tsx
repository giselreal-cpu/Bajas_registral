"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Anticipo } from "@/types/database";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

interface Props {
  facturaId: string;
  saldoPendiente: number;
  anticipos: Anticipo[];
}

export default function AplicarAnticipoButton({ facturaId, saldoPendiente, anticipos }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [anticipoId, setAnticipoId] = useState("");
  const [monto, setMonto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function elegirAnticipo(id: string) {
    setAnticipoId(id);
    const anticipo = anticipos.find((a) => a.id === id);
    if (anticipo) {
      setMonto(String(Math.min(Number(anticipo.saldo_disponible), saldoPendiente)));
    }
  }

  async function handleAplicar() {
    if (!anticipoId || !monto) {
      setError("Elegí un anticipo y cargá un monto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/aplicar-anticipo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anticipo_id: anticipoId, monto: Number(monto) })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setShowForm(false);
      setAnticipoId("");
      setMonto("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return (
      <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setShowForm(true)}>
        Aplicar anticipo
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select className="input w-44 text-xs" value={anticipoId} onChange={(e) => elegirAnticipo(e.target.value)}>
        <option value="">Seleccionar...</option>
        {anticipos.map((a) => (
          <option key={a.id} value={a.id}>
            {formatCurrency(a.saldo_disponible)} disponibles
            {a.observacion ? ` — ${a.observacion}` : ""}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.01"
        className="input w-24 text-xs"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        placeholder="Monto"
      />
      <button className="btn-primary text-xs" disabled={saving} onClick={handleAplicar}>
        {saving ? "Aplicando..." : "Aplicar"}
      </button>
      <button
        type="button"
        className="btn-secondary text-xs"
        onClick={() => {
          setShowForm(false);
          setError(null);
        }}
      >
        Cancelar
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </div>
  );
}
