"use client";

import { useState } from "react";
import Link from "next/link";
import { Anticipo } from "@/types/database";
import AplicarAnticipoButton from "./AplicarAnticipoButton";

export interface FacturaFila {
  id: string;
  numero_factura: number;
  caso_id: string;
  casoTexto: string;
  dominio: string | null;
  servicios: string;
  fecha: string;
  total: number;
  cobrado: number;
  saldo: number;
  estadoLabel: string;
  estadoClase: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default function FacturasTable({
  facturas,
  anticipos
}: {
  facturas: FacturaFila[];
  anticipos: Anticipo[];
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const pendientes = facturas.filter((f) => f.saldo > 0);
  const todasSeleccionadas = pendientes.length > 0 && pendientes.every((f) => seleccion.has(f.id));

  function toggle(id: string) {
    setSeleccion((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function toggleTodas() {
    setSeleccion(todasSeleccionadas ? new Set() : new Set(pendientes.map((f) => f.id)));
  }

  return (
    <div className="space-y-2">
      {pendientes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} />
            Seleccionar todas las pendientes
          </label>
          {seleccion.size > 0 ? (
            <a
              href={`/api/cuenta-corriente/export-seleccion?ids=${Array.from(seleccion).join(",")}`}
              className="btn-secondary text-xs"
            >
              Descargar CSV de {seleccion.size} seleccionada{seleccion.size === 1 ? "" : "s"}
            </a>
          ) : (
            <span className="text-xs text-slate-400">
              Tildá las facturas con saldo para armar un reporte CSV.
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-2 w-6"></th>
              <th className="py-1 pr-4 font-medium">N° factura</th>
              <th className="py-1 pr-4 font-medium">Caso</th>
              <th className="py-1 pr-4 font-medium">Servicio</th>
              <th className="py-1 pr-4 font-medium">Fecha</th>
              <th className="py-1 pr-4 font-medium">Total</th>
              <th className="py-1 pr-4 font-medium">Cobrado</th>
              <th className="py-1 pr-4 font-medium">Saldo</th>
              <th className="py-1 pr-4 font-medium">Estado</th>
              <th className="py-1 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-2">
                  {f.saldo > 0 && (
                    <input
                      type="checkbox"
                      checked={seleccion.has(f.id)}
                      onChange={() => toggle(f.id)}
                      aria-label={`Seleccionar factura ${f.numero_factura}`}
                    />
                  )}
                </td>
                <td className="py-1.5 pr-4">N° {f.numero_factura}</td>
                <td className="py-1.5 pr-4">
                  <Link href={`/casos/${f.caso_id}`} className="text-brand-600 hover:underline">
                    {f.casoTexto}
                  </Link>
                  {f.dominio && <span className="text-slate-400"> · {f.dominio}</span>}
                </td>
                <td className="py-1.5 pr-4 text-slate-600">{f.servicios}</td>
                <td className="py-1.5 pr-4 text-slate-500">
                  {new Date(f.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                </td>
                <td className="py-1.5 pr-4">{formatCurrency(f.total)}</td>
                <td className="py-1.5 pr-4">{formatCurrency(f.cobrado)}</td>
                <td className="py-1.5 pr-4">{formatCurrency(f.saldo)}</td>
                <td className="py-1.5 pr-4">
                  <span className={`badge ${f.estadoClase}`}>{f.estadoLabel}</span>
                </td>
                <td className="py-1.5 pr-4">
                  {f.saldo > 0 && anticipos.length > 0 && (
                    <AplicarAnticipoButton
                      facturaId={f.id}
                      saldoPendiente={f.saldo}
                      anticipos={anticipos}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
