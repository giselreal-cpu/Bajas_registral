"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FilaResultado {
  fila: number;
  ok: boolean;
  error?: string;
  resumen?: string;
}

interface RespuestaImport {
  dryRun: boolean;
  total: number;
  ok: number;
  errores: number;
  creados: number;
  resultados: FilaResultado[];
}

// Importación masiva del Libro de movimientos: siempre pasa primero por
// una vista previa (dryRun=true, no escribe nada) donde se ve fila por
// fila qué se va a crear o qué error tiene, y recién con "Confirmar
// importación" se escribe de verdad — para no cargar datos financieros
// mal interpretados sin poder revisarlos antes.
export default function LibroImportSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csvTexto, setCsvTexto] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [preview, setPreview] = useState<RespuestaImport | null>(null);
  const [resultadoFinal, setResultadoFinal] = useState<RespuestaImport | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function limpiar() {
    setCsvTexto(null);
    setNombreArchivo("");
    setPreview(null);
    setResultadoFinal(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onArchivo(file: File) {
    setError(null);
    setResultadoFinal(null);
    setNombreArchivo(file.name);
    const texto = await file.text();
    setCsvTexto(texto);
    setCargando(true);
    try {
      const res = await fetch("/api/administracion/libro-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: texto, dryRun: true })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo leer el archivo.");
        return;
      }
      setPreview(json as RespuestaImport);
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    if (!csvTexto) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/administracion/libro-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvTexto, dryRun: false })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo importar.");
        return;
      }
      setResultadoFinal(json as RespuestaImport);
      setPreview(null);
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mb-4">
      <button type="button" className="btn-secondary text-xs" onClick={() => setOpen((o) => !o)}>
        {open ? "Cerrar importación" : "Importar movimientos"}
      </button>

      {open && (
        <div className="card p-4 mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Importación masiva de egresos pagados, ingresos cobrados y movimientos generales, a
              partir de una plantilla con los conceptos, cajas y cuentas contables que ya están
              cargados en Catálogos.
            </p>
            <a
              href="/api/administracion/libro-import/plantilla"
              className="btn-secondary text-xs shrink-0"
            >
              Descargar plantilla
            </a>
          </div>

          <div>
            <label className="label">Archivo CSV</label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onArchivo(file);
              }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {cargando && <p className="text-sm text-slate-500">Procesando...</p>}

          {preview && !resultadoFinal && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600">
                  {nombreArchivo} · {preview.total} filas
                </span>
                <span className="badge bg-emerald-100 text-emerald-700">{preview.ok} listas</span>
                {preview.errores > 0 && (
                  <span className="badge bg-red-100 text-red-700">{preview.errores} con error</span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-md">
                <table className="w-full text-xs">
                  <tbody>
                    {preview.resultados.map((r) => (
                      <tr key={r.fila} className="border-t border-slate-100 first:border-t-0">
                        <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">Fila {r.fila}</td>
                        <td className={`px-2 py-1.5 ${r.ok ? "text-slate-700" : "text-red-700"}`}>
                          {r.ok ? r.resumen : r.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={cargando || preview.ok === 0}
                  onClick={confirmar}
                >
                  Confirmar importación ({preview.ok} {preview.ok === 1 ? "fila" : "filas"})
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={limpiar}>
                  Cancelar
                </button>
              </div>
              {preview.errores > 0 && (
                <p className="text-xs text-slate-400">
                  Las filas con error no se importan — corregilas en el archivo y volvé a
                  subirlo, o segui solo con las {preview.ok} que están listas.
                </p>
              )}
            </div>
          )}

          {resultadoFinal && (
            <div className="space-y-2">
              <p className="text-sm text-emerald-700">
                Se importaron {resultadoFinal.creados} de {resultadoFinal.total} filas.
              </p>
              {resultadoFinal.errores > 0 && (
                <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-md">
                  <table className="w-full text-xs">
                    <tbody>
                      {resultadoFinal.resultados
                        .filter((r) => !r.ok)
                        .map((r) => (
                          <tr key={r.fila} className="border-t border-slate-100 first:border-t-0">
                            <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">Fila {r.fila}</td>
                            <td className="px-2 py-1.5 text-red-700">{r.error}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button type="button" className="btn-secondary text-xs" onClick={limpiar}>
                Importar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
