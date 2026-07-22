"use client";

import { useEffect, useState } from "react";
import { BitacoraEvento } from "@/types/database";
import { TIPOS_EVENTO, motivoBloqueo } from "@/lib/eventosBitacora";

interface Props {
  casoId: string;
  soloLectura?: boolean;
}

interface FormEvento {
  tipo_evento: string;
  observacion: string;
  es_interna: boolean;
  completado: boolean;
  fecha_inicio: string;
  fecha_fin: string;
}

function formVacio(): FormEvento {
  return {
    tipo_evento: "",
    observacion: "",
    es_interna: false,
    completado: false,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: ""
  };
}

export default function BitacoraSection({ casoId, soloLectura }: Props) {
  const [eventos, setEventos] = useState<BitacoraEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormEvento>(formVacio());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormEvento>(formVacio());

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
    setError(null);

    if (!form.tipo_evento) {
      setError("Elegí un tipo de evento.");
      return;
    }

    if (form.completado) {
      const bloqueo = motivoBloqueo(form.tipo_evento, eventos ?? []);
      if (bloqueo) {
        setError(bloqueo);
        return;
      }
    }

    setSaving(true);
    const res = await fetch(`/api/casos/${casoId}/bitacora`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: form.tipo_evento,
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

    setForm(formVacio());
    setShowForm(false);
    load();
  }

  function empezarEdicion(ev: BitacoraEvento) {
    setError(null);
    setEditingId(ev.id);
    setEditForm({
      tipo_evento: ev.tipo_evento,
      observacion: ev.observacion ?? "",
      es_interna: ev.es_interna,
      completado: ev.completado,
      fecha_inicio: ev.fecha_inicio,
      fecha_fin: ev.fecha_fin ?? ""
    });
  }

  async function guardarEdicion(id: string) {
    setError(null);

    if (editForm.completado) {
      const bloqueo = motivoBloqueo(editForm.tipo_evento, eventos ?? [], id);
      if (bloqueo) {
        setError(bloqueo);
        return;
      }
    }

    setSaving(true);
    const res = await fetch(`/api/bitacora/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: editForm.tipo_evento,
        observacion: editForm.observacion,
        es_interna: editForm.es_interna,
        completado: editForm.completado,
        fecha_inicio: editForm.fecha_inicio,
        fecha_fin: editForm.fecha_fin || null
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error);
      return;
    }

    setEditingId(null);
    load();
  }

  async function toggleCompletado(evento: BitacoraEvento) {
    setError(null);
    const vaACompletar = !evento.completado;

    if (vaACompletar) {
      const bloqueo = motivoBloqueo(evento.tipo_evento, eventos ?? [], evento.id);
      if (bloqueo) {
        setError(bloqueo);
        return;
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

  const tiposCompletados = new Set(
    (eventos ?? []).filter((ev) => ev.completado).map((ev) => ev.tipo_evento)
  );
  const tiposDisponiblesNuevo = TIPOS_EVENTO.filter(
    (t) => t.label === "Observaciones" || !tiposCompletados.has(t.label)
  );

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-medium text-slate-800">Bitácora</h2>
        {!soloLectura && (
          <button className="btn-secondary text-xs" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancelar" : "+ Agregar evento"}
          </button>
        )}
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
              {tiposDisponiblesNuevo.map((t) => (
                <option key={t.value} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
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
          <div className="grid grid-cols-1 gap-3">
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
        {eventos?.map((ev) => {
          const enEdicion = editingId === ev.id;
          const observacionOculta = ev.es_interna && ev.observacion === null;

          if (enEdicion) {
            return (
              <li key={ev.id} className="border border-brand-200 bg-brand-50/40 rounded-lg p-3 text-sm space-y-3">
                <div>
                  <label className="label">Tipo de evento</label>
                  <select
                    className="input"
                    value={editForm.tipo_evento}
                    onChange={(e) => setEditForm((f) => ({ ...f, tipo_evento: e.target.value }))}
                  >
                    {tiposDisponiblesNuevo.map((t) => (
                      <option key={t.value} value={t.label}>
                        {t.label}
                      </option>
                    ))}
                    {!tiposDisponiblesNuevo.some((t) => t.label === editForm.tipo_evento) && (
                      <option value={editForm.tipo_evento}>{editForm.tipo_evento}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="label">Observación</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={editForm.observacion}
                    onChange={(e) => setEditForm((f) => ({ ...f, observacion: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="label">Fecha inicio</label>
                    <input
                      type="date"
                      className="input"
                      value={editForm.fecha_inicio}
                      onChange={(e) => setEditForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha fin</label>
                    <input
                      type="date"
                      className="input"
                      value={editForm.fecha_fin}
                      onChange={(e) => setEditForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.es_interna}
                      onChange={(e) => setEditForm((f) => ({ ...f, es_interna: e.target.checked }))}
                    />
                    Observación interna
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.completado}
                      onChange={(e) => setEditForm((f) => ({ ...f, completado: e.target.checked }))}
                    />
                    Completada
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs"
                    disabled={saving}
                    onClick={() => guardarEdicion(ev.id)}
                  >
                    Guardar
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              </li>
            );
          }

          return (
            <li key={ev.id} className="border border-slate-100 rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {ev.tipo_evento}
                    {ev.es_interna && (
                      <span className="badge bg-slate-100 text-slate-500 ml-2">interna</span>
                    )}
                  </p>
                  {observacionOculta ? (
                    <p className="text-slate-400 italic">
                      🔒 Observación interna (visible solo para el responsable del caso)
                    </p>
                  ) : (
                    ev.observacion && (
                      <p className="text-slate-600 whitespace-pre-wrap">{ev.observacion}</p>
                    )
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(ev.fecha_inicio).toLocaleDateString("es-AR")}
                    {ev.fecha_fin &&
                      ` → ${new Date(ev.fecha_fin).toLocaleDateString("es-AR")}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {soloLectura ? (
                    <span
                      className={`badge ${
                        ev.completado
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ev.completado ? "Completada" : "Pendiente"}
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleCompletado(ev)}
                      className={`badge ${
                        ev.completado
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ev.completado ? "Completada" : "Pendiente"}
                    </button>
                  )}
                  {!observacionOculta && !soloLectura && (
                    <button
                      className="text-xs text-slate-400 hover:text-brand-700"
                      onClick={() => empezarEdicion(ev)}
                    >
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {eventos?.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay eventos cargados.</p>
        )}
      </ul>
    </section>
  );
}
