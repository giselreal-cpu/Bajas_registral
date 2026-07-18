"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CasoConRelaciones,
  Desarmadero,
  ESTADOS,
  RAMAS,
  RegistroAutomotor,
  TipoBaja,
  Usuario
} from "@/types/database";

interface Props {
  caso: CasoConRelaciones;
  desarmaderos: Desarmadero[];
  registros: RegistroAutomotor[];
  tiposBaja: TipoBaja[];
  usuarios: Usuario[];
  soloLectura?: boolean;
}

export default function CasoCabecera({
  caso,
  desarmaderos,
  registros,
  tiposBaja,
  usuarios,
  soloLectura
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    estado: caso.estado,
    rama: caso.rama ?? "",
    tipo_tramite: caso.tipo_tramite ?? "",
    desarmadero_id: caso.desarmadero_id ?? "",
    registro_id: caso.registro_id ?? "",
    tipo_baja_id: caso.tipo_baja_id ?? "",
    responsable_id: caso.responsable_id ?? "",
    deuda_patentes: caso.deuda_patentes ?? 0,
    deuda_multas: caso.deuda_multas ?? 0,
    fecha_cierre: caso.fecha_cierre ?? "",
    observaciones: caso.observaciones ?? ""
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/casos/${caso.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        rama: form.rama || null,
        tipo_tramite: form.tipo_tramite || null,
        desarmadero_id: form.desarmadero_id || null,
        registro_id: form.registro_id || null,
        tipo_baja_id: form.tipo_baja_id || null,
        responsable_id: form.responsable_id || null,
        fecha_cierre: form.fecha_cierre || null
      })
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error ?? "No se pudo guardar el caso.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Siniestro {caso.numero_siniestro}
          </h1>
          <p className="text-sm text-slate-500">
            {caso.asegurado?.nombre} · Dominio {caso.vehiculo?.dominio} ·{" "}
            {caso.aseguradora?.nombre}
          </p>
        </div>
        {!editing ? (
          !soloLectura && (
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              Editar
            </button>
          )
        ) : (
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <Field label="Estado">
          {editing ? (
            <select
              className="input"
              value={form.estado}
              onChange={(e) => update("estado", e.target.value as any)}
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          ) : (
            ESTADOS.find((e) => e.value === caso.estado)?.label
          )}
        </Field>

        <Field label="Rama">
          {editing ? (
            <select
              className="input"
              value={form.rama}
              onChange={(e) => update("rama", e.target.value)}
            >
              <option value="">Sin definir</option>
              {RAMAS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            RAMAS.find((r) => r.value === caso.rama)?.label ?? "—"
          )}
        </Field>

        <Field label="Tipo de trámite">
          {editing ? (
            <select
              className="input"
              value={form.tipo_tramite}
              onChange={(e) => update("tipo_tramite", e.target.value)}
            >
              <option value="">Sin definir</option>
              <option value="fisica">Física</option>
              <option value="digital">Digital</option>
            </select>
          ) : caso.tipo_tramite === "fisica" ? (
            "Física"
          ) : caso.tipo_tramite === "digital" ? (
            "Digital"
          ) : (
            "—"
          )}
        </Field>

        <Field label="Tipo de baja">
          {editing ? (
            <select
              className="input"
              value={form.tipo_baja_id}
              onChange={(e) => update("tipo_baja_id", e.target.value)}
            >
              <option value="">Sin definir</option>
              {tiposBaja.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          ) : (
            caso.tipo_baja?.nombre ?? "—"
          )}
        </Field>

        <Field label="Responsable">
          {editing ? (
            <select
              className="input"
              value={form.responsable_id}
              onChange={(e) => update("responsable_id", e.target.value)}
            >
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          ) : (
            caso.responsable?.nombre ?? "—"
          )}
        </Field>

        <Field label="Desarmadero">
          {editing ? (
            <select
              className="input"
              value={form.desarmadero_id}
              onChange={(e) => update("desarmadero_id", e.target.value)}
            >
              <option value="">Sin asignar</option>
              {desarmaderos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          ) : (
            caso.desarmadero?.nombre ?? "—"
          )}
        </Field>

        <Field label="Registro automotor">
          {editing ? (
            <select
              className="input"
              value={form.registro_id}
              onChange={(e) => update("registro_id", e.target.value)}
            >
              <option value="">Sin asignar</option>
              {registros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.numero}
                  {r.seccional ? ` (${r.seccional})` : ""}
                </option>
              ))}
            </select>
          ) : caso.registro ? (
            `${caso.registro.numero}${caso.registro.seccional ? ` (${caso.registro.seccional})` : ""}`
          ) : (
            "—"
          )}
        </Field>

        <Field label="Deuda patentes">
          {editing ? (
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.deuda_patentes}
              onChange={(e) => update("deuda_patentes", Number(e.target.value))}
            />
          ) : (
            formatCurrency(caso.deuda_patentes)
          )}
        </Field>

        <Field label="Deuda multas">
          {editing ? (
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.deuda_multas}
              onChange={(e) => update("deuda_multas", Number(e.target.value))}
            />
          ) : (
            formatCurrency(caso.deuda_multas)
          )}
        </Field>

        <Field label="Fecha de ingreso">
          {new Date(caso.fecha_ingreso).toLocaleDateString("es-AR")}
        </Field>

        <Field label="Fecha de cierre">
          {editing ? (
            <input
              type="date"
              className="input"
              value={form.fecha_cierre}
              onChange={(e) => update("fecha_cierre", e.target.value)}
            />
          ) : caso.fecha_cierre ? (
            new Date(caso.fecha_cierre).toLocaleDateString("es-AR")
          ) : (
            "—"
          )}
        </Field>
      </div>

      <div className="mt-4">
        <div className="label">Observaciones</div>
        {editing ? (
          <textarea
            className="input"
            rows={3}
            value={form.observaciones}
            onChange={(e) => update("observaciones", e.target.value)}
          />
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {caso.observaciones || "—"}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}
