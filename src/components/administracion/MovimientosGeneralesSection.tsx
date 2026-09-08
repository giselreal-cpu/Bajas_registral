"use client";

import { useEffect, useState } from "react";
import { Caja, CuentaContable, MovimientoGeneral, TipoMovimiento } from "@/types/database";

function formatCurrency(value: number, moneda: "ARS" | "USD" = "ARS"): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: moneda });
}

interface Props {
  cajas: Caja[];
  cuentas: CuentaContable[];
  esAdministrador: boolean;
}

interface FormState {
  fecha: string;
  descripcion: string;
  tipo: TipoMovimiento;
  monto: string;
  caja_id: string;
  cuenta_contable_id: string;
}

function formVacio(): FormState {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: "",
    tipo: "egreso",
    monto: "",
    caja_id: "",
    cuenta_contable_id: ""
  };
}

// Ingresos/egresos que no son de un caso puntual (sueldos, hosting,
// alquiler, gastos bancarios, etc.) — comparten cajas y cuentas
// contables con los movimientos por caso, así entran en el mismo "Libro
// de movimientos" y "Liquidez" de más arriba, pero se cargan y editan
// acá porque no tienen un caso al que atarse.
export default function MovimientosGeneralesSection({ cajas, cuentas, esAdministrador }: Props) {
  const [movimientos, setMovimientos] = useState<MovimientoGeneral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio());
  const [saving, setSaving] = useState(false);

  async function cargar() {
    const res = await fetch("/api/movimientos-generales");
    const json = await res.json();
    if (res.ok) setMovimientos(json.data);
    else setError(json.error);
  }

  useEffect(() => {
    cargar();
  }, []);

  const cuentasDelTipo = cuentas.filter((c) => c.tipo === form.tipo);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.descripcion.trim() || !form.monto) {
      setError("Cargá una descripción y un monto.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/movimientos-generales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: form.fecha,
          descripcion: form.descripcion.trim(),
          tipo: form.tipo,
          monto: Number(form.monto),
          caja_id: form.caja_id || null,
          cuenta_contable_id: form.cuenta_contable_id || null
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setForm(formVacio());
      setShowForm(false);
      cargar();
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: string) {
    // Un movimiento general representa plata ya real desde que se
    // carga — no se borra, se anula con motivo (el backend también lo
    // exige, y solo un administrador puede hacerlo).
    const motivo = prompt("Este movimiento no se puede borrar — indicá el motivo de la anulación:");
    if (motivo === null) return;
    if (!motivo.trim()) {
      setError("La anulación necesita un motivo.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/movimientos-generales/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivo.trim() })
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    cargar();
  }

  const totalIngresos = (movimientos ?? [])
    .filter((m) => m.tipo === "ingreso" && !m.anulado)
    .reduce((a, m) => a + Number(m.monto), 0);
  const totalEgresos = (movimientos ?? [])
    .filter((m) => m.tipo === "egreso" && !m.anulado)
    .reduce((a, m) => a + Number(m.monto), 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500 max-w-lg">
          Ingresos y egresos que no son de un caso puntual — sueldos, hosting/plataforma,
          alquiler, gastos bancarios, etc. Se suman igual en el Libro de movimientos y en
          Liquidez de arriba.
        </p>
        <button className="btn-primary shrink-0" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "+ Nuevo movimiento"}
        </button>
      </div>

      {error && <div className="card p-3 mb-4 text-sm text-red-600">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 mb-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="col-span-2 sm:flex-1 sm:min-w-[220px]">
            <label className="label">Descripción *</label>
            <input
              required
              className="input"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Sueldo septiembre, Hosting Vercel"
            />
          </div>
          <div className="sm:w-32">
            <label className="label">Tipo</label>
            <select
              className="input"
              value={form.tipo}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipo: e.target.value as TipoMovimiento, cuenta_contable_id: "" }))
              }
            >
              <option value="egreso">Egreso</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
          <div className="sm:w-40">
            <label className="label">Monto *</label>
            <input
              required
              type="number"
              step="0.01"
              className="input"
              value={form.monto}
              onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
            />
          </div>
          <div className="sm:w-40">
            <label className="label">Fecha</label>
            <input
              type="date"
              className="input"
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div className="sm:flex-1 sm:min-w-[160px]">
            <label className="label">Caja</label>
            <select
              className="input"
              value={form.caja_id}
              onChange={(e) => setForm((f) => ({ ...f, caja_id: e.target.value }))}
            >
              <option value="">Sin asignar</option>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:flex-1 sm:min-w-[200px]">
            <label className="label">Cuenta contable</label>
            <select
              className="input"
              value={form.cuenta_contable_id}
              onChange={(e) => setForm((f) => ({ ...f, cuenta_contable_id: e.target.value }))}
            >
              <option value="">Sin asignar</option>
              {cuentasDelTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary col-span-2 sm:col-span-1" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Cuenta</th>
              <th className="px-4 py-2 font-medium">Caja</th>
              <th className="px-4 py-2 font-medium text-right">Monto</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(movimientos ?? []).map((m) => (
              <tr key={m.id} className={`border-t border-slate-100 ${m.anulado ? "bg-red-50/40" : ""}`}>
                <td
                  className={`px-4 py-2 tabular-nums whitespace-nowrap ${m.anulado ? "line-through opacity-60" : ""}`}
                >
                  {new Date(m.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                </td>
                <td className={`px-4 py-2 ${m.anulado ? "line-through opacity-60" : ""}`}>
                  {m.descripcion}
                  {m.anulado && <span className="badge ml-2 bg-red-100 text-red-700">Anulado</span>}
                </td>
                <td
                  className={`px-4 py-2 text-xs text-slate-500 whitespace-nowrap ${m.anulado ? "line-through opacity-60" : ""}`}
                >
                  {m.cuenta_contable?.codigo ?? "—"}
                </td>
                <td className={`px-4 py-2 text-slate-600 ${m.anulado ? "line-through opacity-60" : ""}`}>
                  {m.caja?.nombre ?? "Sin asignar"}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${
                    m.anulado ? "line-through opacity-60 text-slate-400" : m.tipo === "egreso" ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {m.tipo === "egreso" ? "− " : ""}
                  {formatCurrency(m.monto)}
                </td>
                <td className="px-4 py-2 text-right">
                  {m.anulado ? (
                    <span className="text-xs text-red-600">{m.anulado_motivo}</span>
                  ) : (
                    esAdministrador && (
                      <button
                        className="text-xs text-slate-400 hover:text-red-600"
                        onClick={() => handleEliminar(m.id)}
                      >
                        Anular
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {movimientos !== null && movimientos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay movimientos generales cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {movimientos && movimientos.length > 0 && (
        <div className="flex justify-end gap-8 mt-4 pt-3 border-t border-slate-100 text-right">
          <div>
            <div className="label">Ingresos</div>
            <div className="font-semibold text-slate-800">{formatCurrency(totalIngresos)}</div>
          </div>
          <div>
            <div className="label">Egresos</div>
            <div className="font-semibold text-red-700">− {formatCurrency(totalEgresos)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
