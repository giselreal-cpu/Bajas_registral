"use client";

import { useEffect, useState } from "react";

export interface CatalogColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  displayValue?: (row: Row) => string;
}

interface Props {
  title: string;
  description?: string;
  endpoint: string; // ej: "/api/aseguradoras"
  columns: CatalogColumn[];
}

type Row = Record<string, any>;

function emptyForm(columns: CatalogColumn[]): Row {
  const obj: Row = {};
  for (const c of columns) obj[c.key] = "";
  return obj;
}

export default function CatalogTable({ title, description, endpoint, columns }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRow, setNewRow] = useState<Row>(emptyForm(columns));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Row>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(endpoint);
    const json = await res.json();
    if (res.ok) setRows(json.data);
    else setError(json.error);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRow)
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error);
      return;
    }
    setNewRow(emptyForm(columns));
    setShowNew(false);
    load();
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditRow({ ...row });
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    setError(null);
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editRow)
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

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setError(null);
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(
        json.error?.includes("foreign key")
          ? "No se puede eliminar: hay casos que lo referencian."
          : json.error
      );
      return;
    }
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        <button className="btn-primary" onClick={() => setShowNew((s) => !s)}>
          {showNew ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {error && (
        <div className="card p-3 mb-4 text-sm text-red-600 border-red-200 bg-red-50">
          {error}
        </div>
      )}

      {showNew && (
        <form onSubmit={handleCreate} className="card p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {columns.map((c) => (
              <div key={c.key}>
                <label className="label">
                  {c.label}
                  {c.required && " *"}
                </label>
                {c.type === "textarea" ? (
                  <textarea
                    className="input"
                    rows={2}
                    required={c.required}
                    value={newRow[c.key] ?? ""}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, [c.key]: e.target.value }))
                    }
                  />
                ) : c.type === "select" ? (
                  <select
                    className="input"
                    required={c.required}
                    value={newRow[c.key] ?? ""}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, [c.key]: e.target.value }))
                    }
                  >
                    <option value="">Seleccionar...</option>
                    {c.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    required={c.required}
                    value={newRow[c.key] ?? ""}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, [c.key]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-2 font-medium w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 align-top">
                      {isEditing ? (
                        c.type === "textarea" ? (
                          <textarea
                            className="input"
                            rows={2}
                            value={editRow[c.key] ?? ""}
                            onChange={(e) =>
                              setEditRow((r) => ({ ...r, [c.key]: e.target.value }))
                            }
                          />
                        ) : c.type === "select" ? (
                          <select
                            className="input"
                            value={editRow[c.key] ?? ""}
                            onChange={(e) =>
                              setEditRow((r) => ({ ...r, [c.key]: e.target.value }))
                            }
                          >
                            <option value="">Seleccionar...</option>
                            {c.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input"
                            value={editRow[c.key] ?? ""}
                            onChange={(e) =>
                              setEditRow((r) => ({ ...r, [c.key]: e.target.value }))
                            }
                          />
                        )
                      ) : c.type === "select" ? (
                        c.options?.find((o) => o.value === row[c.key])?.label ?? "—"
                      ) : (
                        row[c.key] || "—"
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-xs"
                          disabled={saving}
                          onClick={() => handleSaveEdit(row.id)}
                        >
                          Guardar
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => startEdit(row)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-secondary text-xs text-red-600"
                          onClick={() => handleDelete(row.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows?.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No hay registros todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
