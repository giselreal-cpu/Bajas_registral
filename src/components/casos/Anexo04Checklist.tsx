"use client";

import { useEffect, useState } from "react";
import { TIPOS_VEHICULO } from "@/types/database";

interface Pieza {
  codigo: string;
  descripcion: string;
  categoria: "APC" | "C";
  requierePerito: boolean;
  decision: "SI" | "NO" | null;
  nota: string | null;
}

interface Documento {
  id: string;
  nombre: string;
  url_firmada: string | null;
  created_at: string;
}

interface Estado {
  tipoVehiculo: string | null;
  dominio: string | null;
  piezas: Pieza[];
  documento: Documento | null;
}

const OPCIONES: { value: "SI" | "NO" | null; label: string; claseActiva: string }[] = [
  { value: "SI", label: "SI", claseActiva: "bg-emerald-600 text-white" },
  { value: "NO", label: "NO", claseActiva: "bg-red-600 text-white" },
  { value: null, label: "?", claseActiva: "bg-amber-500 text-white" }
];

export default function Anexo04Checklist({ casoId }: { casoId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipoElegido, setTipoElegido] = useState("");
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const [guardandoCodigo, setGuardandoCodigo] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  async function load() {
    const res = await fetch(`/api/casos/${casoId}/anexo04`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo cargar.");
      return;
    }
    setEstado(json.data);
    setTipoElegido(json.data.tipoVehiculo ?? "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function guardarTipoVehiculo() {
    if (!tipoElegido) return;
    setGuardandoTipo(true);
    const res = await fetch(`/api/casos/${casoId}/anexo04/tipo-vehiculo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_vehiculo: tipoElegido })
    });
    setGuardandoTipo(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "No se pudo guardar el tipo de vehículo.");
      return;
    }
    load();
  }

  async function elegirDecision(codigo: string, decision: "SI" | "NO" | null) {
    setGuardandoCodigo(codigo);
    setEstado((e) =>
      e ? { ...e, piezas: e.piezas.map((p) => (p.codigo === codigo ? { ...p, decision } : p)) } : e
    );

    const res = await fetch(`/api/casos/${casoId}/anexo04`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, decision })
    });

    setGuardandoCodigo(null);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "No se pudo guardar.");
      load();
    }
  }

  async function generar() {
    setGenerando(true);
    setError(null);
    const res = await fetch(`/api/casos/${casoId}/anexo04/generar`, { method: "POST" });
    const json = await res.json();
    setGenerando(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo generar el Anexo 04.");
      return;
    }
    load();
  }

  if (error && !estado) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!estado) {
    return <p className="text-sm text-slate-500">Cargando...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="card p-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="label">Tipo de vehículo</label>
          <select
            className="input"
            value={tipoElegido}
            onChange={(e) => setTipoElegido(e.target.value)}
          >
            <option value="">Sin elegir</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Es la clave para resolver las reglas por pieza. Al elegirlo, se auto-completa el
            checklist de abajo (sin pisar excepciones ya cargadas).
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={!tipoElegido || guardandoTipo}
          onClick={guardarTipoVehiculo}
        >
          {guardandoTipo ? "Guardando..." : "Guardar"}
        </button>
      </section>

      <section className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-800">Documento generado</h2>
          {estado.documento ? (
            <p className="text-sm text-slate-500">
              {estado.documento.nombre} ·{" "}
              {new Date(estado.documento.created_at).toLocaleString("es-AR")}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Todavía no se generó ningún Anexo 04.</p>
          )}
        </div>
        <div className="flex gap-2">
          {estado.documento?.url_firmada && (
            <a href={estado.documento.url_firmada} target="_blank" rel="noreferrer" className="btn-secondary">
              Descargar último
            </a>
          )}
          <button
            className="btn-primary"
            disabled={!estado.tipoVehiculo || generando}
            onClick={generar}
            title={!estado.tipoVehiculo ? "Elegí primero el tipo de vehículo" : ""}
          >
            {generando ? "Generando..." : "Generar Anexo 04"}
          </button>
        </div>
      </section>

      {error && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">{error}</div>
      )}

      <section className="card p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left px-3 py-2 font-medium text-slate-600">Pieza</th>
                <th className="px-2 py-2 font-medium text-slate-600 text-center">Decisión</th>
              </tr>
            </thead>
            <tbody>
              {estado.piezas.map((p) => (
                <tr
                  key={p.codigo}
                  className={`border-b border-slate-100 ${
                    p.decision === null ? "bg-amber-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-3 py-1.5">
                    <div className="text-slate-800">{p.descripcion}</div>
                    <div className="text-xs text-slate-400">
                      #{p.codigo} · {p.categoria}
                      {p.requierePerito ? " · requiere perito" : ""}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-center gap-1">
                      {OPCIONES.map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          disabled={guardandoCodigo === p.codigo}
                          onClick={() => elegirDecision(p.codigo, o.value)}
                          className={`w-8 h-7 rounded text-xs font-medium border ${
                            p.decision === o.value
                              ? `${o.claseActiva} border-transparent`
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
