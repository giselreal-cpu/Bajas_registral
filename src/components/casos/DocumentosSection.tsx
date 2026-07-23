"use client";

import { useEffect, useState } from "react";
import { Documento } from "@/types/database";

const CATEGORIAS: { value: Documento["categoria"]; label: string }[] = [
  { value: "imagen_dominio", label: "Imagen del dominio" },
  { value: "documento_compania", label: "Documento para la compañía" }
];

export default function DocumentosSection({
  casoId,
  soloLectura
}: {
  casoId: string;
  soloLectura?: boolean;
}) {
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [categoriaSobre, setCategoriaSobre] = useState<Documento["categoria"] | null>(null);

  const [form, setForm] = useState({
    categoria: "imagen_dominio" as Documento["categoria"],
    nombre: "",
    url: ""
  });

  async function load() {
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos`);
      const json = await res.json();
      if (res.ok) setDocumentos(json.data);
      else setError(json.error);
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setForm({ categoria: "imagen_dominio", nombre: "", url: "" });
      setShowForm(false);
      load();
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      const res = await fetch(`/api/documentos/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      load();
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  async function moverACategoria(id: string, categoria: Documento["categoria"]) {
    const documento = documentos?.find((d) => d.id === id);
    if (!documento || documento.categoria === categoria) return;

    // Actualización optimista: lo movemos ya mismo en pantalla, y si el
    // guardado falla, recargamos desde el servidor para no dejar la
    // vista desincronizada.
    setDocumentos((docs) =>
      (docs ?? []).map((d) => (d.id === id ? { ...d, categoria } : d))
    );

    try {
      const res = await fetch(`/api/documentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        load();
      }
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
      load();
    }
  }

  const grupos = {
    imagen_dominio: documentos?.filter((d) => d.categoria === "imagen_dominio") ?? [],
    documento_compania:
      documentos?.filter((d) => d.categoria === "documento_compania") ?? []
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-medium text-slate-800">Documentos</h2>
        {!soloLectura && (
          <button className="btn-secondary text-xs" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancelar" : "+ Agregar documento"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {!soloLectura && documentos && documentos.length > 0 && (
        <p className="text-xs text-slate-400 mb-3">
          Arrastrá un documento entre las dos listas para corregir su categoría.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 border-b border-slate-100 pb-4">
          <div>
            <label className="label">Categoría</label>
            <select
              className="input"
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value as Documento["categoria"] }))
              }
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nombre *</label>
            <input
              required
              className="input"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">URL *</label>
            <input
              required
              className="input"
              placeholder="Enlace al archivo en Supabase Storage o Drive"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar documento"}
          </button>
        </form>
      )}

      {CATEGORIAS.map((c) => (
        <div
          key={c.value}
          onDragOver={(e) => {
            if (soloLectura) return;
            e.preventDefault();
            setCategoriaSobre(c.value);
          }}
          onDragLeave={() => setCategoriaSobre((cat) => (cat === c.value ? null : cat))}
          onDrop={(e) => {
            e.preventDefault();
            setCategoriaSobre(null);
            if (soloLectura || !arrastrandoId) return;
            moverACategoria(arrastrandoId, c.value);
            setArrastrandoId(null);
          }}
          className={`mb-4 rounded-lg p-2 -m-2 transition-colors ${
            categoriaSobre === c.value ? "bg-brand-50 ring-2 ring-brand-200" : ""
          }`}
        >
          <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">{c.label}</h3>
          <ul className="space-y-1">
            {grupos[c.value].map((d) => (
              <li
                key={d.id}
                draggable={!soloLectura}
                onDragStart={() => setArrastrandoId(d.id)}
                onDragEnd={() => setArrastrandoId(null)}
                className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm ${
                  !soloLectura ? "cursor-move hover:bg-slate-50" : ""
                } ${arrastrandoId === d.id ? "opacity-40" : ""}`}
              >
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline truncate"
                >
                  {d.nombre}
                </a>
                {!soloLectura && (
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-xs text-slate-400 hover:text-red-600 shrink-0"
                  >
                    Eliminar
                  </button>
                )}
              </li>
            ))}
            {grupos[c.value].length === 0 && (
              <p className="text-sm text-slate-400">Sin documentos.</p>
            )}
          </ul>
        </div>
      ))}
    </section>
  );
}
