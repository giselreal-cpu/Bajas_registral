"use client";

import { useEffect, useState } from "react";
import { Tramitador } from "@/types/database";

// Desplegable de trámitadores de UNA compañía, con alta rápida ahí mismo
// ("+ Agregar nuevo trámitador"). Evita cargar el mismo nombre escrito de
// distintas formas y que se mezclen trámitadores de compañías distintas.
export default function TramitadorSelect({
  aseguradoraId,
  tramitadores,
  value,
  onChange
}: {
  aseguradoraId: string;
  tramitadores: Tramitador[];
  value: string;
  onChange: (t: Tramitador | null) => void;
}) {
  const [creados, setCreados] = useState<Tramitador[]>([]);
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = [...tramitadores, ...creados.filter((c) => !tramitadores.some((t) => t.id === c.id))]
    .filter((t) => t.aseguradora_id === aseguradoraId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Si se cambia la compañía, el trámitador elegido de la anterior ya no aplica.
  useEffect(() => {
    if (value && !disponibles.some((t) => t.id === value)) onChange(null);
    setAgregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aseguradoraId]);

  async function guardarNuevo() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return;
    setError(null);

    const existente = disponibles.find((t) => t.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (existente) {
      onChange(existente);
      setAgregando(false);
      setNombre("");
      setEmail("");
      return;
    }

    setGuardando(true);
    const res = await fetch("/api/tramitadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreLimpio, email: email.trim(), aseguradora_id: aseguradoraId })
    });
    const json = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(json.error ?? "No se pudo agregar el trámitador.");
      return;
    }

    setCreados((c) => [...c, json.data]);
    onChange(json.data);
    setAgregando(false);
    setNombre("");
    setEmail("");
  }

  if (!aseguradoraId) {
    return (
      <select className="input" disabled>
        <option>Elegí primero la compañía</option>
      </select>
    );
  }

  const seleccionado = disponibles.find((t) => t.id === value);

  return (
    <div className="space-y-2">
      <select
        className="input"
        value={agregando ? "__nuevo__" : value}
        onChange={(e) => {
          if (e.target.value === "__nuevo__") {
            setAgregando(true);
            return;
          }
          setAgregando(false);
          onChange(disponibles.find((t) => t.id === e.target.value) ?? null);
        }}
      >
        <option value="">Sin trámitador</option>
        {disponibles.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
        <option value="__nuevo__">+ Agregar nuevo trámitador...</option>
      </select>
      {!agregando && seleccionado?.email && (
        <p className="text-xs text-slate-400">{seleccionado.email}</p>
      )}
      {agregando && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <input
            className="input"
            placeholder="Nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-xs" disabled={guardando || !nombre.trim()} onClick={guardarNuevo}>
              {guardando ? "Guardando..." : "Agregar"}
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => setAgregando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
