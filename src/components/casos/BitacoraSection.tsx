"use client";

import { useEffect, useState } from "react";
import { BitacoraEvento } from "@/types/database";
import { TIPOS_EVENTO, ordenDeEvento, pasosPendientesAnteriores } from "@/lib/eventosBitacora";

export default function BitacoraSection({ casoId }: { casoId: string }) {
  const [eventos, setEventos] = useState<BitacoraEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tipo_evento: "",
    tipo_evento_otro: "",
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

  function resetForm() {
    setForm({
      tipo_evento: "",
      tipo_evento_otro: "",
      observacion: "",
      es_interna: false,
      completado: false,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: ""
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const etiquetaFinal =
      form.tipo_evento === "otro" ? form.tipo_evento_otro.trim() : form.tipo_evento;

    if (!etiquetaFinal) {
      setError('Elegí un tipo de evento (o completá el detalle si elegiste "Otro").');
      return;
    }

    // Validación de secuencia: no dejamos completar un paso de la secuencia
    // principal si los pasos anteriores todavía no están completados.
    const orden = ordenDeEvento(etiquetaFinal);
    if (orden !== null && form.completado) {
      const pendientes = pasosPendientesAnteriores(orden, eventos ?? []);
      if (pendientes.length > 0) {
        setError(
          `No se puede marcar como completado "${etiquetaFinal}" porque todavía faltan pasos anteriores: ${pendientes.join(", ")}.`
        );
        return;
      }
    }

    setSaving(true);
    const res = await fetch(`/api/casos/${casoId}/bitacora`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: etiquetaFinal,
        observacion: form.observacion,
        es_interna: form.es_interna,
        completado: form.completado,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error);
      return;
    }

    resetForm();
    setShowForm(false);
    load();
  }

  async function toggleCompletado(evento: BitacoraEvento) {
    setError(null);
    const vaACompletar = !evento.completado;

    if (vaACompletar) {
      const orden = ordenDeEvento(evento.tipo_evento);
      if (orden !== null) {
        const pendientes = pasosPendientesAnteriores(orden, eventos ?? []);
        if (pendientes.length > 0) {
          setError(
            `No se puede completar "${evento.tipo_evento}" porque todavía faltan pasos anteriores: ${pendientes.join(", ")}.`
          );
          return;
        }
      }
    }

    const res = await fetch(`/api/bitacora/${evento.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completado: vaACompletar })
    });
    const json = await res.json();
    if (res.ok) load();
    else setError(json.error);
  }

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-800">Bitácora</h2>
        <button className="btn-secondary text-xs" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "+ Agregar evento"}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 border-b border-slate-100 pb-4">
          <div>
            <label className="label">Tipo de evento *</label>
            <select
              required
              className="input"
              value={form.tipo_evento}
              onChange={(e) => setForm((f) => ({ ...f, tipo_evento: e.target.value }))}
            >
              <option value="">Seleccionar...</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.orden ? `${t.orden}. ${t.label}` : t.label}
                </option>
              ))}
            </select>
          </div>

          {form.tipo_evento === "otro" && (
            <div>
              <label className="label">Detalle del evento *</label>
              <input
                required
                className="input"
                placeholder="Describí el evento"
                value={form.tipo_evento_otro}
                onChange={(e) => setForm((f) => ({ ...f, tipo_evento_otro: e.target.value }))}
              />
            </div>
          )}

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
          <li key={ev.id} className="border border-slate-100 rounded-lg p-3 text-sm">
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
