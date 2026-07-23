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
  esAdministrador?: boolean;
}

export default function CasoCabecera({
  caso,
  desarmaderos,
  registros,
  tiposBaja,
  usuarios,
  soloLectura,
  esAdministrador
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    numero_siniestro: caso.numero_siniestro,
    vehiculo_dominio: caso.vehiculo?.dominio ?? "",
    vehiculo_marca: caso.vehiculo?.marca ?? "",
    vehiculo_modelo: caso.vehiculo?.modelo ?? "",
    vehiculo_anio: caso.vehiculo?.anio ?? "",
    numero_poliza: caso.numero_poliza ?? "",
    item_poliza: caso.item_poliza ?? "",
    estado: caso.estado,
    rama: caso.rama ?? "",
    tipo_tramite: caso.tipo_tramite ?? "",
    desarmadero_id: caso.desarmadero_id ?? "",
    registro_id: caso.registro_id ?? "",
    tipo_baja_id: caso.tipo_baja_id ?? "",
    responsable_id: caso.responsable_id ?? "",
    deuda_patentes: caso.deuda_patentes ?? 0,
    deuda_multas: caso.deuda_multas ?? 0,
    suma_asegurada: caso.suma_asegurada ?? 0,
    fecha_cierre: caso.fecha_cierre ?? "",
    observaciones: caso.observaciones ?? "",
    tercero_nombre: caso.tercero_nombre ?? "",
    tercero_dni: caso.tercero_dni ?? "",
    tercero_contacto: caso.tercero_contacto ?? "",
    asegurado_nombre: caso.asegurado?.nombre ?? "",
    asegurado_dni: caso.asegurado?.dni ?? "",
    asegurado_telefono: caso.asegurado?.telefono ?? "",
    asegurado_email: caso.asegurado?.email ?? "",
    asegurado_direccion: caso.asegurado?.direccion ?? "",
    asegurado_localidad: caso.asegurado?.localidad ?? "",
    asegurado_provincia: caso.asegurado?.provincia ?? "",
    asegurado_entre_calles: caso.asegurado?.entre_calles ?? "",
    asegurado_partido: caso.asegurado?.partido ?? ""
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const [resCaso, resVehiculo, resAsegurado] = await Promise.all([
      fetch(`/api/casos/${caso.id}`, {
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
          fecha_cierre: form.fecha_cierre || null,
          tercero_nombre: form.tercero_nombre || null,
          tercero_dni: form.tercero_dni || null,
          tercero_contacto: form.tercero_contacto || null
        })
      }),
      fetch(`/api/vehiculos/${caso.vehiculo_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dominio: form.vehiculo_dominio.toUpperCase(),
          marca: form.vehiculo_marca || null,
          modelo: form.vehiculo_modelo || null,
          anio: form.vehiculo_anio ? Number(form.vehiculo_anio) : null
        })
      }),
      fetch(`/api/asegurados/${caso.asegurado_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.asegurado_nombre,
          dni: form.asegurado_dni || null,
          telefono: form.asegurado_telefono || null,
          email: form.asegurado_email || null,
          direccion: form.asegurado_direccion || null,
          localidad: form.asegurado_localidad || null,
          provincia: form.asegurado_provincia || null,
          entre_calles: form.asegurado_entre_calles || null,
          partido: form.asegurado_partido || null
        })
      })
    ]);

    const [jsonCaso, jsonVehiculo, jsonAsegurado] = await Promise.all([
      resCaso.json(),
      resVehiculo.json(),
      resAsegurado.json()
    ]);
    setSaving(false);

    if (!resCaso.ok || !resVehiculo.ok || !resAsegurado.ok) {
      setError(
        jsonCaso.error ?? jsonVehiculo.error ?? jsonAsegurado.error ?? "No se pudo guardar el caso."
      );
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        `¿Eliminar el caso ${caso.numero_siniestro}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/casos/${caso.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setError(json.error ?? "No se pudo eliminar el caso.");
      return;
    }

    router.push("/casos");
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
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
          <div className="flex gap-2">
            {!soloLectura && (
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                Editar
              </button>
            )}
            {esAdministrador && (
              <button
                className="btn-secondary text-red-600 hover:bg-red-50 hover:border-red-300"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Eliminando..." : "Eliminar caso"}
              </button>
            )}
          </div>
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

      <Section title="Datos del caso" first>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="N° de siniestro">
            {editing ? (
              <input
                className="input"
                value={form.numero_siniestro}
                onChange={(e) => update("numero_siniestro", e.target.value)}
              />
            ) : (
              caso.numero_siniestro
            )}
          </Field>

          <Field label="N° de póliza">
            {editing ? (
              <input
                className="input"
                value={form.numero_poliza}
                onChange={(e) => update("numero_poliza", e.target.value)}
              />
            ) : (
              caso.numero_poliza || "—"
            )}
          </Field>

          <Field label="Ítem">
            {editing ? (
              <input
                className="input"
                value={form.item_poliza}
                onChange={(e) => update("item_poliza", e.target.value)}
              />
            ) : (
              caso.item_poliza || "—"
            )}
          </Field>

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
        </div>
      </Section>

      <Section title="Trámite">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
      </Section>

      <Section title="Vehículo">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Dominio">
            {editing ? (
              <input
                className="input uppercase"
                value={form.vehiculo_dominio}
                onChange={(e) => update("vehiculo_dominio", e.target.value)}
              />
            ) : (
              caso.vehiculo?.dominio || "—"
            )}
          </Field>

          <Field label="Marca">
            {editing ? (
              <input
                className="input"
                value={form.vehiculo_marca}
                onChange={(e) => update("vehiculo_marca", e.target.value)}
              />
            ) : (
              caso.vehiculo?.marca || "—"
            )}
          </Field>

          <Field label="Modelo">
            {editing ? (
              <input
                className="input"
                value={form.vehiculo_modelo}
                onChange={(e) => update("vehiculo_modelo", e.target.value)}
              />
            ) : (
              caso.vehiculo?.modelo || "—"
            )}
          </Field>

          <Field label="Año">
            {editing ? (
              <input
                type="number"
                className="input"
                value={form.vehiculo_anio}
                onChange={(e) => update("vehiculo_anio", e.target.value)}
              />
            ) : (
              caso.vehiculo?.anio || "—"
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
        </div>
      </Section>

      <Section title="Datos económicos">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Suma asegurada">
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.suma_asegurada}
                onChange={(e) => update("suma_asegurada", Number(e.target.value))}
              />
            ) : (
              formatCurrency(caso.suma_asegurada)
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
        </div>
      </Section>

      <Section title="Observaciones">
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
      </Section>

      <Section title="Asegurado / titular">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Nombre y apellido">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_nombre}
                onChange={(e) => update("asegurado_nombre", e.target.value)}
              />
            ) : (
              caso.asegurado?.nombre || "—"
            )}
          </Field>
          <Field label="DNI">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_dni}
                onChange={(e) => update("asegurado_dni", e.target.value)}
              />
            ) : (
              caso.asegurado?.dni || "—"
            )}
          </Field>
          <Field label="Teléfono">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_telefono}
                onChange={(e) => update("asegurado_telefono", e.target.value)}
              />
            ) : (
              caso.asegurado?.telefono || "—"
            )}
          </Field>
          <Field label="Email">
            {editing ? (
              <input
                type="email"
                className="input"
                value={form.asegurado_email}
                onChange={(e) => update("asegurado_email", e.target.value)}
              />
            ) : (
              caso.asegurado?.email || "—"
            )}
          </Field>
          <Field label="Dirección">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_direccion}
                onChange={(e) => update("asegurado_direccion", e.target.value)}
              />
            ) : (
              caso.asegurado?.direccion || "—"
            )}
          </Field>
          <Field label="Entre calles">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_entre_calles}
                onChange={(e) => update("asegurado_entre_calles", e.target.value)}
              />
            ) : (
              caso.asegurado?.entre_calles || "—"
            )}
          </Field>
          <Field label="Localidad">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_localidad}
                onChange={(e) => update("asegurado_localidad", e.target.value)}
              />
            ) : (
              caso.asegurado?.localidad || "—"
            )}
          </Field>
          <Field label="Partido">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_partido}
                onChange={(e) => update("asegurado_partido", e.target.value)}
              />
            ) : (
              caso.asegurado?.partido || "—"
            )}
          </Field>
          <Field label="Provincia">
            {editing ? (
              <input
                className="input"
                value={form.asegurado_provincia}
                onChange={(e) => update("asegurado_provincia", e.target.value)}
              />
            ) : (
              caso.asegurado?.provincia || "—"
            )}
          </Field>
        </div>
      </Section>

      <Section title="Tercero autorizado a entregar la unidad (si no es el asegurado)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Nombre y apellido">
            {editing ? (
              <input
                className="input"
                value={form.tercero_nombre}
                onChange={(e) => update("tercero_nombre", e.target.value)}
              />
            ) : (
              caso.tercero_nombre || "—"
            )}
          </Field>
          <Field label="DNI">
            {editing ? (
              <input
                className="input"
                value={form.tercero_dni}
                onChange={(e) => update("tercero_dni", e.target.value)}
              />
            ) : (
              caso.tercero_dni || "—"
            )}
          </Field>
          <Field label="Contacto">
            {editing ? (
              <input
                className="input"
                value={form.tercero_contacto}
                onChange={(e) => update("tercero_contacto", e.target.value)}
              />
            ) : (
              caso.tercero_contacto || "—"
            )}
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  first
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div className={first ? "" : "mt-5 pt-5 border-t border-slate-100"}>
      <h3 className="font-heading text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
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
