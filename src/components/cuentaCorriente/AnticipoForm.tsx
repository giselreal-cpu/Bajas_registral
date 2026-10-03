"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Anticipo, Caja, CuentaContable, TipoReceptor } from "@/types/database";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

interface Props {
  tipo: TipoReceptor;
  receptorId: string;
  saldoDisponible: number;
  anticipos: Anticipo[];
  cajas: Caja[];
  cuentas: CuentaContable[];
}

export default function AnticipoForm({ tipo, receptorId, saldoDisponible, anticipos, cajas, cuentas }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [observacion, setObservacion] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [cuentaContableId, setCuentaContableId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function limpiar() {
    setEditandoId(null);
    setMonto("");
    setFecha("");
    setObservacion("");
    setCajaId("");
    setCuentaContableId("");
    setError(null);
    setShowForm(false);
  }

  function empezarEdicion(a: Anticipo) {
    setEditandoId(a.id);
    setMonto(String(a.monto));
    setFecha(a.fecha);
    setObservacion(a.observacion ?? "");
    setCajaId(a.caja_id ?? "");
    setCuentaContableId(a.cuenta_contable_id ?? "");
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!monto) {
      setError("Cargá un monto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = editandoId
        ? await fetch(`/api/anticipos/${editandoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monto: Number(monto),
              fecha: fecha || undefined,
              observacion,
              caja_id: cajaId || null,
              cuenta_contable_id: cuentaContableId || null
            })
          })
        : await fetch("/api/anticipos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo_receptor: tipo,
              receptor_id: receptorId,
              monto: Number(monto),
              fecha: fecha || undefined,
              observacion,
              caja_id: cajaId || null,
              cuenta_contable_id: cuentaContableId || null
            })
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      limpiar();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const ordenados = [...anticipos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">
          {saldoDisponible > 0 ? formatCurrency(saldoDisponible) : "—"}
        </span>
        <button
          type="button"
          className="text-brand-600 hover:underline"
          onClick={() => (showForm ? limpiar() : setShowForm(true))}
        >
          {showForm ? "Cancelar" : "+ Registrar anticipo"}
        </button>
      </div>

      {ordenados.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ordenados.map((a) => {
            const usado = Number(a.monto) - Number(a.saldo_disponible);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 text-slate-600">
                <span>{new Date(a.fecha + "T00:00:00").toLocaleDateString("es-AR")}</span>
                <span className="font-medium">{formatCurrency(Number(a.monto))}</span>
                <span className="text-slate-400">
                  {usado > 0 ? `usado ${formatCurrency(usado)} · disponible ${formatCurrency(Number(a.saldo_disponible))}` : "sin usar"}
                </span>
                {a.observacion && <span className="text-slate-400">{a.observacion}</span>}
                <button
                  type="button"
                  className="text-brand-600 hover:underline"
                  onClick={() => empezarEdicion(a)}
                >
                  Editar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2">
          {editandoId && <p className="w-full text-slate-500">Editando anticipo</p>}
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
            <label className="label">Fecha</label>
            <input
              type="date"
              className="input w-36"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
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
          <div>
            <label className="label">Caja</label>
            <select className="input w-40" value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
              <option value="">Caja pesos (por defecto)</option>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cuenta contable</label>
            <select
              className="input w-52"
              value={cuentaContableId}
              onChange={(e) => setCuentaContableId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {cuentas.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.codigo} · {cc.nombre}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary text-xs" disabled={saving} type="submit">
            {saving ? "Guardando..." : editandoId ? "Guardar cambios" : "Guardar"}
          </button>
          {error && <p className="text-red-600 w-full">{error}</p>}
        </form>
      )}
    </div>
  );
}
