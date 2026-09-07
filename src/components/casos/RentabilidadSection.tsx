"use client";

import { useEffect, useState } from "react";
import {
  Anticipo,
  CasoConRelaciones,
  ComercialAseguradora,
  ConceptoMovimiento,
  ESTADOS_FACTURA,
  Factura,
  MovimientoCaso,
  TipoReceptor
} from "@/types/database";
import MovimientoPagadoToggle from "./MovimientoPagadoToggle";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function estadoFacturaBadgeClass(estado: string) {
  switch (estado) {
    case "cobrado_total":
      return "bg-emerald-100 text-emerald-700";
    case "cobrado_parcial":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

interface Props {
  casoId: string;
  caso: CasoConRelaciones;
}

interface FormMovimiento {
  concepto_id: string;
  monto: string;
  fecha: string;
  observacion: string;
  pagado: boolean;
}

function formVacio(): FormMovimiento {
  return {
    concepto_id: "",
    monto: "",
    fecha: new Date().toISOString().slice(0, 10),
    observacion: "",
    pagado: false
  };
}

export default function RentabilidadSection({ casoId, caso }: Props) {
  const [conceptos, setConceptos] = useState<ConceptoMovimiento[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaso[] | null>(null);
  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [comercial, setComercial] = useState<ComercialAseguradora | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormMovimiento>(formVacio());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormMovimiento>(formVacio());

  const [showFacturaForm, setShowFacturaForm] = useState(false);
  const [tipoReceptor, setTipoReceptor] = useState<TipoReceptor>("compania");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [facturaFechaVencimiento, setFacturaFechaVencimiento] = useState("");
  const [facturaFormaPago, setFacturaFormaPago] = useState("");
  const [savingFactura, setSavingFactura] = useState(false);

  const [cobroFacturaId, setCobroFacturaId] = useState<string | null>(null);
  const [cobroMonto, setCobroMonto] = useState("");
  const [cobroMedioPago, setCobroMedioPago] = useState("");
  const [savingCobro, setSavingCobro] = useState(false);

  const [anticiposCompania, setAnticiposCompania] = useState<Anticipo[]>([]);
  const [anticiposDesarmadero, setAnticiposDesarmadero] = useState<Anticipo[]>([]);
  const [anticipoFacturaId, setAnticipoFacturaId] = useState<string | null>(null);
  const [anticipoId, setAnticipoId] = useState("");
  const [anticipoMonto, setAnticipoMonto] = useState("");
  const [savingAnticipo, setSavingAnticipo] = useState(false);

  const [notaFacturaId, setNotaFacturaId] = useState<string | null>(null);
  const [notaMonto, setNotaMonto] = useState("");
  const [notaMotivo, setNotaMotivo] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  async function loadMovimientos() {
    const res = await fetch(`/api/casos/${casoId}/movimientos`);
    const json = await res.json();
    if (res.ok) setMovimientos(json.data);
    else setError(json.error);
  }

  async function loadFacturas() {
    const res = await fetch(`/api/casos/${casoId}/facturas`);
    const json = await res.json();
    if (res.ok) setFacturas(json.data);
    else setError(json.error);
  }

  async function loadAnticipos() {
    if (caso.aseguradora_id) {
      const res = await fetch(`/api/anticipos?tipo=compania&receptor_id=${caso.aseguradora_id}`);
      const json = await res.json();
      if (res.ok) setAnticiposCompania(json.data ?? []);
    }
    if (caso.desarmadero_id) {
      const res = await fetch(`/api/anticipos?tipo=desarmadero&receptor_id=${caso.desarmadero_id}`);
      const json = await res.json();
      if (res.ok) setAnticiposDesarmadero(json.data ?? []);
    }
  }

  useEffect(() => {
    fetch("/api/conceptos-movimiento")
      .then((r) => r.json())
      .then((j) => setConceptos(j.data ?? []));
    loadMovimientos();
    loadFacturas();
    loadAnticipos();
    if (caso.aseguradora_id) {
      fetch(`/api/aseguradoras/${caso.aseguradora_id}/comercial`)
        .then((r) => r.json())
        .then((j) => setComercial(j.data ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  function anticiposDe(f: Factura): Anticipo[] {
    const lista = f.tipo_receptor === "compania" ? anticiposCompania : anticiposDesarmadero;
    return lista.filter((a) => a.saldo_disponible > 0);
  }

  function montoSugerido(conceptoId: string): string {
    const concepto = conceptos.find((c) => c.id === conceptoId);
    if (!concepto || !comercial) return "";

    if (concepto.nombre === "Cobro al desarmadero" && comercial.porcentaje_desarmadero && caso.valor_infoauto) {
      return String(
        Math.round(caso.valor_infoauto * (comercial.porcentaje_desarmadero / 100) * 100) / 100
      );
    }
    if (concepto.nombre === "Pago a la compañía" && comercial.porcentaje_compania) {
      const base =
        comercial.base_calculo_compania === "suma_asegurada"
          ? caso.suma_asegurada
          : caso.valor_infoauto;
      if (base) {
        return String(Math.round(base * (comercial.porcentaje_compania / 100) * 100) / 100);
      }
    }
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.concepto_id || !form.monto) {
      setError("Elegí un concepto y cargá un monto.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/casos/${casoId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concepto_id: form.concepto_id,
          monto: Number(form.monto),
          fecha: form.fecha,
          observacion: form.observacion,
          pagado: form.pagado
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setForm(formVacio());
      setShowForm(false);
      loadMovimientos();
    } finally {
      setSaving(false);
    }
  }

  function empezarEdicion(m: MovimientoCaso) {
    setError(null);
    setEditingId(m.id);
    setEditForm({
      concepto_id: m.concepto_id,
      monto: String(m.monto),
      fecha: m.fecha,
      observacion: m.observacion ?? "",
      pagado: m.pagado
    });
  }

  async function guardarEdicion(id: string) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/movimientos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concepto_id: editForm.concepto_id,
          monto: Number(editForm.monto),
          fecha: editForm.fecha,
          observacion: editForm.observacion,
          pagado: editForm.pagado
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setEditingId(null);
      loadMovimientos();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    setError(null);
    const res = await fetch(`/api/movimientos/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    loadMovimientos();
  }

  const movimientosSinFacturar = (movimientos ?? []).filter(
    (m) => !m.factura_id && m.concepto?.tipo === "ingreso"
  );

  async function handleGenerarFactura(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (seleccionados.length === 0) {
      setError("Elegí al menos un movimiento para facturar.");
      return;
    }
    const receptorId = tipoReceptor === "compania" ? caso.aseguradora_id : caso.desarmadero_id;
    if (!receptorId) {
      setError(
        tipoReceptor === "compania"
          ? "El caso no tiene aseguradora asignada."
          : "El caso no tiene desarmadero asignado."
      );
      return;
    }
    setSavingFactura(true);
    try {
      const res = await fetch(`/api/casos/${casoId}/facturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_receptor: tipoReceptor,
          receptor_id: receptorId,
          movimiento_ids: seleccionados,
          fecha_vencimiento: facturaFechaVencimiento || null,
          forma_pago: facturaFormaPago || null
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setSeleccionados([]);
      setFacturaFechaVencimiento("");
      setFacturaFormaPago("");
      setShowFacturaForm(false);
      loadFacturas();
      loadMovimientos();
    } finally {
      setSavingFactura(false);
    }
  }

  async function handleRegistrarCobro(facturaId: string) {
    if (!cobroMonto) {
      setError("Cargá el monto del cobro.");
      return;
    }
    setSavingCobro(true);
    setError(null);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/cobros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: Number(cobroMonto), medio_pago: cobroMedioPago })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setCobroFacturaId(null);
      setCobroMonto("");
      setCobroMedioPago("");
      loadFacturas();
    } finally {
      setSavingCobro(false);
    }
  }

  async function handleEliminarCobro(facturaId: string, cobroId: string) {
    if (!confirm("¿Eliminar este cobro? (por ejemplo, si se cargó por error). Si venía de un anticipo, se le devuelve el saldo.")) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/facturas/${facturaId}/cobros/${cobroId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    loadFacturas();
  }

  async function handleEliminarNotaCredito(facturaId: string, notaId: string) {
    if (!confirm("¿Eliminar esta nota de crédito? (por ejemplo, si el monto se calculó mal). El saldo pendiente de la factura vuelve a subir.")) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/facturas/${facturaId}/notas-credito/${notaId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    loadFacturas();
  }

  async function handleEliminarFactura(facturaId: string) {
    if (!confirm("¿Eliminar esta factura? Sus movimientos volverán a quedar sin facturar.")) return;
    setError(null);
    const res = await fetch(`/api/facturas/${facturaId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    loadFacturas();
    loadMovimientos();
  }

  async function handleAplicarAnticipo(facturaId: string) {
    if (!anticipoId || !anticipoMonto) {
      setError("Elegí un anticipo y cargá un monto.");
      return;
    }
    setSavingAnticipo(true);
    setError(null);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/aplicar-anticipo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anticipo_id: anticipoId, monto: Number(anticipoMonto) })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setAnticipoFacturaId(null);
      setAnticipoId("");
      setAnticipoMonto("");
      loadFacturas();
      loadAnticipos();
    } finally {
      setSavingAnticipo(false);
    }
  }

  async function handleEmitirNota(facturaId: string) {
    if (!notaMonto || !notaMotivo.trim()) {
      setError("Cargá el monto y el motivo de la nota de crédito.");
      return;
    }
    setSavingNota(true);
    setError(null);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/notas-credito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: Number(notaMonto), motivo: notaMotivo })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setNotaFacturaId(null);
      setNotaMonto("");
      setNotaMotivo("");
      loadFacturas();
    } finally {
      setSavingNota(false);
    }
  }

  // Ingresos = plata efectivamente cobrada (cobros + notas de crédito de
  // las facturas de este caso), no lo devengado al cargar el movimiento.
  // Un ingreso sin facturar o facturado pero no cobrado todavía no suma
  // acá, aunque siga listado abajo como pendiente.
  const totalIngresos = (facturas ?? []).reduce((acc, f) => {
    const cobradoFactura =
      (f.cobros ?? []).reduce((a, c) => a + Number(c.monto), 0) +
      (f.notas_credito ?? []).reduce((a, n) => a + Number(n.monto), 0);
    return acc + cobradoFactura;
  }, 0);
  const totalEgresos = (movimientos ?? [])
    .filter((m) => m.concepto?.tipo === "egreso")
    .reduce((acc, m) => acc + Number(m.monto), 0);
  const gananciaNeta = totalIngresos - totalEgresos;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-medium text-slate-800">Rentabilidad</h2>
        <button className="btn-secondary text-xs" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "+ Agregar movimiento"}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Ingresos = plata efectivamente cobrada, no lo facturado pendiente.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
        <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2">
          <div className="text-xs text-emerald-700">Ingresos</div>
          <div className="font-semibold text-emerald-800">{formatCurrency(totalIngresos)}</div>
        </div>
        <div className="rounded-md bg-red-50 border border-red-100 p-2">
          <div className="text-xs text-red-700">Egresos</div>
          <div className="font-semibold text-red-800">{formatCurrency(totalEgresos)}</div>
        </div>
        <div
          className={`rounded-md border p-2 ${
            gananciaNeta >= 0
              ? "bg-accent-50 border-accent-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="text-xs text-slate-600">Ganancia neta</div>
          <div className={`font-semibold ${gananciaNeta >= 0 ? "text-accent-700" : "text-red-800"}`}>
            {formatCurrency(gananciaNeta)}
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 border-b border-slate-100 pb-4">
          <div>
            <label className="label">Concepto *</label>
            <select
              required
              className="input"
              value={form.concepto_id}
              onChange={(e) => {
                const concepto_id = e.target.value;
                setForm((f) => ({
                  ...f,
                  concepto_id,
                  monto: montoSugerido(concepto_id) || f.monto
                }));
              }}
            >
              <option value="">Seleccionar...</option>
              {conceptos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Monto *</label>
            <input
              required
              type="number"
              step="0.01"
              className="input"
              value={form.monto}
              onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input
              type="date"
              className="input"
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Observación</label>
            <input
              className="input"
              value={form.observacion}
              onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
            />
          </div>
          {conceptos.find((c) => c.id === form.concepto_id)?.tipo === "egreso" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pagado}
                onChange={(e) => setForm((f) => ({ ...f, pagado: e.target.checked }))}
              />
              Ya está pagado (si no, queda como pendiente de pago)
            </label>
          )}
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar movimiento"}
          </button>
        </form>
      )}

      <ul className="space-y-2 mb-5">
        {movimientos?.map((m) => {
          const enEdicion = editingId === m.id;
          if (enEdicion) {
            return (
              <li
                key={m.id}
                className="border border-brand-200 bg-brand-50/40 rounded-lg p-3 text-sm space-y-2"
              >
                <select
                  className="input"
                  value={editForm.concepto_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, concepto_id: e.target.value }))}
                >
                  {conceptos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.tipo})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={editForm.monto}
                  onChange={(e) => setEditForm((f) => ({ ...f, monto: e.target.value }))}
                />
                <input
                  type="date"
                  className="input"
                  value={editForm.fecha}
                  onChange={(e) => setEditForm((f) => ({ ...f, fecha: e.target.value }))}
                />
                <input
                  className="input"
                  value={editForm.observacion}
                  onChange={(e) => setEditForm((f) => ({ ...f, observacion: e.target.value }))}
                />
                {conceptos.find((c) => c.id === editForm.concepto_id)?.tipo === "egreso" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.pagado}
                      onChange={(e) => setEditForm((f) => ({ ...f, pagado: e.target.checked }))}
                    />
                    Ya está pagado
                  </label>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs"
                    disabled={saving}
                    onClick={() => guardarEdicion(m.id)}
                  >
                    Guardar
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">
                  {m.concepto?.nombre ?? "—"}
                  <span
                    className={`badge ml-2 ${
                      m.concepto?.tipo === "ingreso"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {m.concepto?.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                  </span>
                  {m.factura_id && (
                    <span className="badge ml-1 bg-slate-100 text-slate-500">Facturado</span>
                  )}
                  {m.concepto?.tipo === "egreso" && (
                    <span className="ml-1 inline-block">
                      <MovimientoPagadoToggle
                        movimientoId={m.id}
                        pagado={m.pagado}
                        onChange={loadMovimientos}
                      />
                    </span>
                  )}
                </p>
                {m.observacion && <p className="text-slate-500">{m.observacion}</p>}
                <p className="text-xs text-slate-400">
                  {new Date(m.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-medium text-slate-800">{formatCurrency(m.monto)}</span>
                {!m.factura_id && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      className="text-xs text-slate-400 hover:text-brand-700"
                      onClick={() => empezarEdicion(m)}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-slate-400 hover:text-red-600"
                      onClick={() => handleDelete(m.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {movimientos?.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay movimientos cargados.</p>
        )}
      </ul>

      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-sm font-semibold text-slate-700">Facturas</h3>
          {movimientosSinFacturar.length > 0 && (
            <button
              className="btn-secondary text-xs"
              onClick={() => setShowFacturaForm((s) => !s)}
            >
              {showFacturaForm ? "Cancelar" : "+ Generar factura"}
            </button>
          )}
        </div>

        {showFacturaForm && (
          <form
            onSubmit={handleGenerarFactura}
            className="mb-4 space-y-3 border border-slate-100 rounded-lg p-3"
          >
            <div>
              <label className="label">Receptor</label>
              <select
                className="input"
                value={tipoReceptor}
                onChange={(e) => setTipoReceptor(e.target.value as TipoReceptor)}
              >
                <option value="compania">Compañía ({caso.aseguradora?.nombre ?? "—"})</option>
                <option value="desarmadero">
                  Desarmadero ({caso.desarmadero?.nombre ?? "sin asignar"})
                </option>
              </select>
            </div>
            <div>
              <label className="label">Movimientos a incluir</label>
              <div className="space-y-1">
                {movimientosSinFacturar.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(m.id)}
                      onChange={(e) =>
                        setSeleccionados((s) =>
                          e.target.checked ? [...s, m.id] : s.filter((id) => id !== m.id)
                        )
                      }
                    />
                    {m.concepto?.nombre} — {formatCurrency(m.monto)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha de vencimiento</label>
                <input
                  type="date"
                  className="input"
                  value={facturaFechaVencimiento}
                  onChange={(e) => setFacturaFechaVencimiento(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Forma de pago</label>
                <input
                  className="input"
                  placeholder="Efectivo, transferencia..."
                  value={facturaFormaPago}
                  onChange={(e) => setFacturaFormaPago(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-primary text-sm" disabled={savingFactura} type="submit">
              {savingFactura ? "Generando..." : "Generar factura"}
            </button>
          </form>
        )}

        <ul className="space-y-2">
          {facturas?.map((f) => {
            const cobrado = (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0);
            const acreditadoPorNotas = (f.notas_credito ?? []).reduce(
              (acc, n) => acc + Number(n.monto),
              0
            );
            const saldo = f.monto_total - cobrado - acreditadoPorNotas;
            const anticiposDisponibles = anticiposDe(f);
            return (
              <li key={f.id} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-800">N° {f.numero_factura}</span>{" "}
                    <span className="text-slate-500">
                      · {f.tipo_receptor === "compania" ? "Compañía" : "Desarmadero"} ·{" "}
                      {new Date(f.fecha_emision + "T00:00:00").toLocaleDateString("es-AR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${estadoFacturaBadgeClass(f.estado)}`}>
                      {ESTADOS_FACTURA.find((e) => e.value === f.estado)?.label ?? f.estado}
                    </span>
                    {f.tipo_receptor === "desarmadero" && (
                      <a
                        href={`/api/facturas/${f.id}/orden-cobro`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Descargar detalle
                      </a>
                    )}
                    {cobrado === 0 && acreditadoPorNotas === 0 && (
                      <button
                        className="text-xs text-slate-400 hover:text-red-600"
                        onClick={() => handleEliminarFactura(f.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-slate-600">
                  Total: {formatCurrency(f.monto_total)} · Cobrado: {formatCurrency(cobrado)}
                  {acreditadoPorNotas > 0 && (
                    <> · Notas de crédito: {formatCurrency(acreditadoPorNotas)}</>
                  )}{" "}
                  · Saldo: {formatCurrency(saldo)}
                </div>
                {(f.cobros ?? []).length > 0 && (
                  <ul className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {f.cobros?.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <span>
                          Cobro {formatCurrency(c.monto)}
                          {c.medio_pago && ` — ${c.medio_pago}`} —{" "}
                          {new Date(c.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                        </span>
                        <button
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => handleEliminarCobro(f.id, c.id)}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {(f.notas_credito ?? []).length > 0 && (
                  <ul className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {f.notas_credito?.map((n) => (
                      <li key={n.id} className="flex items-center gap-2">
                        <span>
                          Nota de crédito {formatCurrency(n.monto)} — {n.motivo}
                        </span>
                        <button
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => handleEliminarNotaCredito(f.id, n.id)}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {f.estado !== "cobrado_total" && (
                  <div className="mt-2 space-y-2">
                    {cobroFacturaId === f.id && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="label">Monto cobrado</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input w-32"
                            value={cobroMonto}
                            onChange={(e) => setCobroMonto(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">Medio de pago</label>
                          <input
                            className="input w-40"
                            value={cobroMedioPago}
                            onChange={(e) => setCobroMedioPago(e.target.value)}
                          />
                        </div>
                        <button
                          className="btn-primary text-xs"
                          disabled={savingCobro}
                          onClick={() => handleRegistrarCobro(f.id)}
                        >
                          Registrar
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => setCobroFacturaId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {anticipoFacturaId === f.id && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="label">Anticipo</label>
                          <select
                            className="input w-52"
                            value={anticipoId}
                            onChange={(e) => setAnticipoId(e.target.value)}
                          >
                            <option value="">Seleccionar...</option>
                            {anticiposDisponibles.map((a) => (
                              <option key={a.id} value={a.id}>
                                {formatCurrency(a.saldo_disponible)} disponibles
                                {a.observacion ? ` — ${a.observacion}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Monto a aplicar</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input w-32"
                            value={anticipoMonto}
                            onChange={(e) => setAnticipoMonto(e.target.value)}
                          />
                        </div>
                        <button
                          className="btn-primary text-xs"
                          disabled={savingAnticipo}
                          onClick={() => handleAplicarAnticipo(f.id)}
                        >
                          Aplicar
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => setAnticipoFacturaId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {notaFacturaId === f.id && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="label">Monto</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input w-32"
                            value={notaMonto}
                            onChange={(e) => setNotaMonto(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">Motivo</label>
                          <input
                            className="input w-52"
                            value={notaMotivo}
                            onChange={(e) => setNotaMotivo(e.target.value)}
                          />
                        </div>
                        <button
                          className="btn-primary text-xs"
                          disabled={savingNota}
                          onClick={() => handleEmitirNota(f.id)}
                        >
                          Emitir
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => setNotaFacturaId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {cobroFacturaId !== f.id && anticipoFacturaId !== f.id && notaFacturaId !== f.id && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => setCobroFacturaId(f.id)}
                        >
                          Registrar cobro
                        </button>
                        {anticiposDisponibles.length > 0 && (
                          <button
                            className="text-xs text-brand-600 hover:underline"
                            onClick={() => setAnticipoFacturaId(f.id)}
                          >
                            Aplicar anticipo
                          </button>
                        )}
                        <button
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => setNotaFacturaId(f.id)}
                        >
                          Emitir nota de crédito
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {facturas?.length === 0 && (
            <p className="text-sm text-slate-500">Todavía no hay facturas generadas.</p>
          )}
        </ul>
      </div>
    </section>
  );
}
