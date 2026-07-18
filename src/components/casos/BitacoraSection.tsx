"use client";

import { useEffect, useState } from "react";
import { BitacoraEvento } from "@/types/database";

export default function BitacoraSection({ casoId }: { casoId: string }) {
  const [eventos, setEventos] = useState<BitacoraEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tipo_evento: "",
    observacion: "",
    es_interna: false,
    completado: false,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: ""
  });

  async function load() {
    const res = await fetch(`/api/casos/${casoId}/bitacora`);
    const json = await res.json();
    if (res.ok) setEventos(json.data);
    else setError(json.error);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/casos/${casoId}/bitacora`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fecha_fin: form.fecha_fin || null
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error);
      return;
    }

    setForm({
      tipo_evento: "",
      observacion: "",
      es_interna: false,
      completado: false,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: ""
    });
    setShowForm(false);
    load();
  }

  async function toggleCompletado(evento: BitacoraEvento) {
    const res = await fetch(`/api/bitacora/${evento.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completado: !evento.completado })
    });
    if (res.ok) load();
  }

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-800">Bitácora</h2>
        <button className="btn-secondary text-xs" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "+ Agregar evento"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 border-b border-slate-100 pb-4">
          <div>
            <label className="label">Tipo de evento *</label>
            <input
              required
              className="input"
              placeholder='Ej: "Inicia baja", "Pedido de traslado"'
              value={form.tipo_evento}
              onChange={(e) => setForm((f) => ({ ...f, tipo_evento: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Observación</label>
            <textarea
              className="input"
              rows={2}
              value={form.observacion}
              onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha inicio</label>
              <input
                type="date"
                className="input"
                value={form.fecha_inicio}
                onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Fecha fin</label>
              <input
                type="date"
                className="input"
                value={form.fecha_fin}
                onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.es_interna}
                onChange={(e) => setForm((f) => ({ ...f, es_interna: e.target.checked }))}
              />
              Observación interna
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.completado}
                onChange={(e) => setForm((f) => ({ ...f, completado: e.target.checked }))}
              />
              Completada
            </label>
          </div>
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar evento"}
          </button>
        </form>
      )}

      <ul className="space-y-3 max-h-[28rem] overflow-y-auto">
        {eventos?.map((ev) => (
          <li key={ev.id} className="border border-slate-100 rounded-md p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">
                  {ev.tipo_evento}
                  {ev.es_interna && (
                    <span className="badge bg-slate-100 text-slate-500 ml-2">interna</span>
                  )}
                </p>
                {ev.observacion && (
                  <p className="text-slate-600 whitespace-pre-wrap">{ev.observacion}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(ev.fecha_inicio).toLocaleDateString("es-AR")}
                  {ev.fecha_fin &&
                    ` → ${new Date(ev.fecha_fin).toLocaleDateString("es-AR")}`}
                </p>
              </div>
              <button
                onClick={() => toggleCompletado(ev)}
                className={`badge shrink-0 ${
                  ev.completado
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {ev.completado ? "Completada" : "Pendiente"}
              </button>
            </div>
          </li>
        ))}
        {eventos?.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay eventos cargados.</p>
        )}
      </ul>
    </section>
  );
}
