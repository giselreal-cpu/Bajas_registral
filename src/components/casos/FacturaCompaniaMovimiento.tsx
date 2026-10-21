"use client";

import { useState } from "react";

// Control de la factura que emite la compañía por un "Pago a la compañía":
// si ya se recibió (con su número y fecha) o todavía falta. Se guarda en el
// propio movimiento; no depende de que el movimiento esté pagado, pero el
// listado de Seguimiento solo reclama las de bajas ya pagadas.

interface Props {
  movimientoId: string;
  recibida: boolean;
  numero: string | null;
  fecha: string | null;
  soloLectura?: boolean;
  onChange: () => void;
}

export default function FacturaCompaniaMovimiento({
  movimientoId,
  recibida,
  numero,
  fecha,
  soloLectura,
  onChange
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [numeroForm, setNumeroForm] = useState("");
  const [fechaForm, setFechaForm] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cuerpo: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    const res = await fetch(`/api/movimientos/${movimientoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo)
    });
    const json = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo guardar.");
      return;
    }
    setAbierto(false);
    onChange();
  }

  if (recibida) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 ml-1">
        <span className="badge bg-emerald-100 text-emerald-700">
          Factura de la compañía recibida
          {numero ? ` · N° ${numero}` : ""}
          {fecha ? ` · ${new Date(fecha + "T00:00:00").toLocaleDateString("es-AR")}` : ""}
        </span>
        {!soloLectura && (
          <button
            type="button"
            disabled={guardando}
            className="text-xs text-slate-400 hover:text-red-600"
            onClick={() =>
              guardar({ factura_compania_recibida: false, factura_compania_numero: null, factura_compania_fecha: null })
            }
          >
            Quitar
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 ml-1">
      <span className="badge bg-amber-100 text-amber-700">Sin factura de la compañía</span>
      {!soloLectura && !abierto && (
        <button type="button" className="text-xs text-accent-700 hover:underline" onClick={() => setAbierto(true)}>
          Marcar recibida
        </button>
      )}
      {abierto && (
        <span className="inline-flex flex-wrap items-center gap-1">
          <input
            className="input !py-0.5 !text-xs w-36"
            placeholder="N° de factura (opcional)"
            value={numeroForm}
            onChange={(e) => setNumeroForm(e.target.value)}
          />
          <input
            type="date"
            className="input !py-0.5 !text-xs w-32"
            value={fechaForm}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFechaForm(e.target.value)}
          />
          <button
            type="button"
            disabled={guardando}
            className="btn-secondary text-xs"
            onClick={() =>
              guardar({
                factura_compania_recibida: true,
                factura_compania_numero: numeroForm.trim() || null,
                factura_compania_fecha: fechaForm || null
              })
            }
          >
            Guardar
          </button>
          <button type="button" className="text-xs text-slate-400" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
