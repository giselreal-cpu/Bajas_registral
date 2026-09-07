"use client";

import { useEffect, useState } from "react";
import { CATEGORIAS_GESTOR, Documento } from "@/types/database";

const CATEGORIAS_STAFF: { value: "imagen_dominio" | "documento_compania"; label: string }[] = [
  { value: "imagen_dominio", label: "Imágenes del dominio" },
  { value: "documento_compania", label: "Documentos para la Cía" }
];

const TODAS_LAS_CATEGORIAS = [...CATEGORIAS_STAFF, ...CATEGORIAS_GESTOR];

interface Props {
  casoId: string;
  soloLectura?: boolean;
}

export default function DocumentosMobile({ casoId, soloLectura }: Props) {
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoriaAbierta, setCategoriaAbierta] = useState<Documento["categoria"] | null>(null);
  const [modo, setModo] = useState<"link" | "archivo">("archivo");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/casos/${casoId}/documentos`);
      const json = await res.json();
      if (res.ok) setDocumentos(json.data);
      else setError(json.error);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaAbierta) return;
    if (modo === "archivo" && !file) {
      setError("Elegí un archivo.");
      return;
    }
    if (modo === "link" && !url.trim()) {
      setError("Pegá un link.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("categoria", categoriaAbierta);
      if (modo === "archivo" && file) body.append("file", file);
      else body.append("url", url.trim());

      const res = await fetch(`/api/casos/${casoId}/documentos`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setUrl("");
      setFile(null);
      load();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  if (!documentos) {
    return <p className="text-sm text-slate-500 p-1">Cargando documentos...</p>;
  }

  const categoriaActual = TODAS_LAS_CATEGORIAS.find((c) => c.value === categoriaAbierta);
  const documentosCategoria = documentos.filter((d) => d.categoria === categoriaAbierta);

  return (
    <div>
      {error && !categoriaAbierta && (
        <p className="text-sm mb-2" style={{ color: "var(--mv-accent-700)" }}>
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {TODAS_LAS_CATEGORIAS.map((c) => {
          const n = documentos.filter((d) => d.categoria === c.value).length;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCategoriaAbierta(c.value);
                setError(null);
              }}
              className="mv-card text-left flex flex-col justify-between min-h-[96px] p-3.5"
            >
              <span className="mv-heading text-[14.5px] leading-tight">{c.label}</span>
              <span className="flex items-baseline gap-1.5 mt-2">
                <span
                  className="mv-heading text-[26px] tabular-nums leading-none"
                  style={{ color: "var(--mv-accent-700)" }}
                >
                  {n}
                </span>
                <span className="text-[11px]" style={{ color: "var(--mv-neutral-600)" }}>
                  archivos
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {categoriaAbierta && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(32,31,29,0.45)" }}
            onClick={() => setCategoriaAbierta(null)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[85vh] overflow-y-auto"
            style={{
              background: "var(--mv-bg)",
              borderTop: "1px solid var(--mv-divider)",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 12px 32px rgba(45,43,43,0.22)"
            }}
          >
            <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ background: "var(--mv-neutral-400)" }} />
            <h2 className="mv-heading text-lg mb-3">{categoriaActual?.label}</h2>

            {error && (
              <p className="text-sm mb-2" style={{ color: "var(--mv-accent-700)" }}>
                {error}
              </p>
            )}

            <ul className="mb-4">
              {documentosCategoria.map((d) => (
                <li
                  key={d.id}
                  className="text-[13.5px] py-1.5"
                  style={{ borderBottom: "1px solid var(--mv-divider)" }}
                >
                  <a
                    href={d.url_firmada ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate block underline"
                    style={{ color: "var(--mv-accent-700)", textUnderlineOffset: 3 }}
                  >
                    {d.nombre}
                  </a>
                </li>
              ))}
              {documentosCategoria.length === 0 && (
                <p className="text-sm" style={{ color: "var(--mv-neutral-500)" }}>
                  Sin documentos.
                </p>
              )}
            </ul>

            {!soloLectura && (
              <form
                onSubmit={handleSubmit}
                className="space-y-3 pt-4"
                style={{ borderTop: "1px solid var(--mv-divider)" }}
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`mv-btn text-xs flex-1 py-2 ${modo === "archivo" ? "mv-btn-primary" : "mv-btn-secondary"}`}
                    onClick={() => setModo("archivo")}
                  >
                    Subir un archivo
                  </button>
                  <button
                    type="button"
                    className={`mv-btn text-xs flex-1 py-2 ${modo === "link" ? "mv-btn-primary" : "mv-btn-secondary"}`}
                    onClick={() => setModo("link")}
                  >
                    Pegar un link
                  </button>
                </div>
                {modo === "archivo" ? (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    className="mv-input"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                ) : (
                  <input
                    className="mv-input"
                    placeholder="Enlace a la carpeta de Drive u otro archivo ya alojado"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                )}
                <button
                  className="mv-btn mv-btn-primary w-full py-2.5"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Subiendo..." : "Guardar documento"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
