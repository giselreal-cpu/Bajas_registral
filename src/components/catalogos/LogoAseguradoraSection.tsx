"use client";

import { useEffect, useState } from "react";
import { Aseguradora } from "@/types/database";

export default function LogoAseguradoraSection() {
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [aseguradoraId, setAseguradoraId] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch("/api/aseguradoras")
      .then((r) => r.json())
      .then((j) => setAseguradoras(j.data ?? []));
  }, []);

  useEffect(() => {
    const aseguradora = aseguradoras.find((a) => a.id === aseguradoraId);
    setLogoPath(aseguradora?.logo_path ?? null);
    setError(null);
  }, [aseguradoraId, aseguradoras]);

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !aseguradoraId) return;

    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/aseguradoras/${aseguradoraId}/logo`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo subir el logo.");
        return;
      }
      setLogoPath(json.data.logo_path);
      setVersion((v) => v + 1);
      setAseguradoras((lista) =>
        lista.map((a) => (a.id === aseguradoraId ? { ...a, logo_path: json.data.logo_path } : a))
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar() {
    if (!aseguradoraId || !confirm("¿Eliminar el logo cargado?")) return;
    setSaving(true);
    setError(null);
    try {
      await fetch(`/api/aseguradoras/${aseguradoraId}/logo`, { method: "DELETE" });
      setLogoPath(null);
      setAseguradoras((lista) =>
        lista.map((a) => (a.id === aseguradoraId ? { ...a, logo_path: null } : a))
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-4 mt-6">
      <h2 className="font-medium text-slate-800 mb-1">Logo de la compañía</h2>
      <p className="text-sm text-slate-500 mb-4">
        Se usa en el encabezado de la Autorización de retiro y traslado, junto al logo de Oltra.
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
        <div className="flex items-center gap-4">
          {logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/aseguradoras/${aseguradoraId}/logo?v=${version}`}
              alt="Logo actual"
              className="h-16 w-auto border border-slate-200 rounded-md bg-white p-1"
            />
          ) : (
            <span className="text-sm text-slate-400">Sin logo cargado.</span>
          )}
          <div className="flex flex-col gap-1">
            <label className="btn-secondary text-xs cursor-pointer w-fit">
              {saving ? "Subiendo..." : logoPath ? "Reemplazar logo" : "Subir logo"}
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={saving}
                onChange={handleArchivo}
              />
            </label>
            {logoPath && (
              <button
                className="text-xs text-slate-400 hover:text-red-600 w-fit"
                disabled={saving}
                onClick={handleEliminar}
              >
                Eliminar logo
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
