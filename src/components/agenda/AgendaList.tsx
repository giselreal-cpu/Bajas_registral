"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Usuario } from "@/types/database";

interface EventoAgenda {
  id: string;
  caso_id: string;
  tipo_evento: string;
  observacion: string | null;
  es_interna: boolean;
  completado: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
  caso: {
    id: string;
    numero_siniestro: string;
    estado: string;
    asegurado: { nombre: string } | null;
    responsable: { id: string; nombre: string } | null;
  } | null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasDesdeHoy(fecha: string) {
  const hoy = startOfToday();
  const f = new Date(fecha + "T00:00:00");
  return Math.round((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AgendaList() {
  const [eventos, setEventos] = useState<EventoAgenda[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [responsableId, setResponsableId] = useState("");
  const [incluirCompletados, setIncluirCompletados] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (responsableId) params.set("responsable_id", responsableId);
    if (incluirCompletados) params.set("incluir_completados", "true");

    const res = await fetch(`/api/agenda?${params.toString()}`);
    const json = await res.json();
    if (res.ok) setEventos(json.data);
    else setError(json.error);
  }

  useEffect(() => {
    fetch("/api/catalogos")
      .then((r) => r.json())
      .then((data) => setUsuarios(data.usuarios ?? []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsableId, incluirCompletados]);

  async function toggleCompletado(evento: EventoAgenda) {
    const res = await fetch(`/api/bitacora/${evento.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completado: !evento.completado })
    });
    if (res.ok) load();
  }

  const grupos = useMemo(() => {
    const vencidos: EventoAgenda[] = [];
    const proximos: EventoAgenda[] = [];
    const masAdelante: EventoAgenda[] = [];
    const sinFecha: EventoAgenda[] = [];

    for (const ev of eventos ?? []) {
      if (!ev.fecha_fin) {
        sinFecha.push(ev);
        continue;
      }
      const dias = diasDesdeHoy(ev.fecha_fin);
      if (!ev.completado && dias < 0) vencidos.push(ev);
      else if (dias <= 7) proximos.push(ev);
      else masAdelante.push(ev);
    }

    return { vencidos, proximos, masAdelante, sinFecha };
  }, [eventos]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Agenda de vencimientos
          </h1>
          <p className="text-sm text-slate-500">
            Eventos de bitácora pendientes en todos los casos abiertos.
          </p>
        </div>
      </div>

      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Responsable</label>
          <select
            className="input"
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input
            type="checkbox"
            checked={incluirCompletados}
            onChange={(e) => setIncluirCompletados(e.target.checked)}
          />
          Incluir completados
        </label>
      </div>

      {error && (
        <div className="card p-3 mb-4 text-sm text-red-600 border-red-200 bg-red-50">
          {error}
        </div>
      )}

      <Grupo
        titulo="Vencidos"
        colorClase="text-red-600"
        eventos={grupos.vencidos}
        onToggle={toggleCompletado}
      />
      <Grupo
        titulo="Próximos 7 días"
        colorClase="text-amber-600"
        eventos={grupos.proximos}
        onToggle={toggleCompletado}
      />
      <Grupo
        titulo="Más adelante"
        colorClase="text-slate-600"
        eventos={grupos.masAdelante}
        onToggle={toggleCompletado}
      />
      <Grupo
        titulo="Sin fecha de vencimiento"
        colorClase="text-slate-400"
        eventos={grupos.sinFecha}
        onToggle={toggleCompletado}
      />

      {eventos?.length === 0 && (
        <p className="text-sm text-slate-500">
          No hay eventos pendientes. La agenda está al día.
        </p>
      )}
    </div>
  );
}

function Grupo({
  titulo,
  colorClase,
  eventos,
  onToggle
}: {
  titulo: string;
  colorClase: string;
  eventos: EventoAgenda[];
  onToggle: (ev: EventoAgenda) => void;
}) {
  if (eventos.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className={`text-sm font-semibold uppercase mb-2 ${colorClase}`}>
        {titulo} ({eventos.length})
      </h2>
      <div className="card divide-y divide-slate-100">
        {eventos.map((ev) => (
          <div key={ev.id} className="p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/casos/${ev.caso_id}`}
                  className="text-brand-600 font-medium hover:underline"
                >
                  {ev.caso?.numero_siniestro ?? "Caso"}
                </Link>
                <span className="text-sm text-slate-500">
                  {ev.caso?.asegurado?.nombre}
                </span>
                {ev.es_interna && (
                  <span className="badge bg-slate-100 text-slate-500">interna</span>
                )}
              </div>
              <p className="text-sm text-slate-800">{ev.tipo_evento}</p>
              {ev.observacion && (
                <p className="text-sm text-slate-500 truncate">{ev.observacion}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {ev.caso?.responsable?.nombre ?? "Sin responsable"}
                {ev.fecha_fin &&
                  ` · Vence ${new Date(ev.fecha_fin + "T00:00:00").toLocaleDateString("es-AR")}`}
              </p>
            </div>
            <button
              onClick={() => onToggle(ev)}
              className={`badge shrink-0 ${
                ev.completado
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {ev.completado ? "Completado" : "Pendiente"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
