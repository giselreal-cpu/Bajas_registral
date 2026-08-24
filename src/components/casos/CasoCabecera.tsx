"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Aseguradora,
  CasoConRelaciones,
  Desarmadero,
  ESTADOS,
  Gestor,
  RAMAS,
  RegistroAutomotor,
  TipoBaja,
  Usuario
} from "@/types/database";
import SelectorNotificacion from "./SelectorNotificacion";

interface Props {
  caso: CasoConRelaciones;
  aseguradoras: Aseguradora[];
  desarmaderos: Desarmadero[];
  registros: RegistroAutomotor[];
  tiposBaja: TipoBaja[];
  usuarios: Usuario[];
  gestores: Gestor[];
  soloLectura?: boolean;
  esAdministrador?: boolean;
}

export default function CasoCabecera({
  caso,
  aseguradoras,
  desarmaderos,
  registros,
  tiposBaja,
  usuarios,
  gestores,
  soloLectura,
  esAdministrador
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  // Caso recién asignado a un gestor nuevo, para ofrecer notificar por
  // mail — se guarda el objeto ya fresco que devuelve el PUT (con
  // relaciones), no el prop `caso` viejo.
  const [notificarGestor, setNotificarGestor] = useState<CasoConRelaciones | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const [form, setForm] = useState({
    numero_siniestro: caso.numero_siniestro,
    vehiculo_dominio: caso.vehiculo?.dominio ?? "",
    vehiculo_marca: caso.vehiculo?.marca ?? "",
    vehiculo_modelo: caso.vehiculo?.modelo ?? "",
    vehiculo_anio: caso.vehiculo?.anio ?? "",
    numero_poliza: caso.numero_poliza ?? "",
    aseguradora_id: caso.aseguradora_id,
    item_poliza: caso.item_poliza ?? "",
    rama: caso.rama ?? "",
    tipo_tramite: caso.tipo_tramite ?? "",
    desarmadero_id: caso.desarmadero_id ?? "",
    registro_id: caso.registro_id ?? "",
    tipo_baja_id: caso.tipo_baja_id ?? "",
    responsable_id: caso.responsable_id ?? "",
    gestor_id: caso.gestor_id ?? "",
    deuda_patentes: caso.deuda_patentes ?? 0,
    deuda_multas: caso.deuda_multas ?? 0,
    suma_asegurada: caso.suma_asegurada ?? 0,
    valor_infoauto: caso.valor_infoauto ?? 0,
    fecha_cierre: caso.fecha_cierre ?? "",
    observaciones: caso.observaciones ?? "",
    tercero_nombre: caso.tercero_nombre ?? "",
    productor_nombre: caso.productor_nombre ?? "",
    productor_contacto: caso.productor_contacto ?? "",
    tramitador_nombre: caso.tramitador_nombre ?? "",
    tramitador_email: caso.tramitador_email ?? "",
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
          gestor_id: form.gestor_id || null,
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
          casoId: caso.id,
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
          casoId: caso.id,
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

    const gestorNuevo = form.gestor_id && form.gestor_id !== (caso.gestor_id ?? "");
    if (gestorNuevo) {
      setNotificarGestor(jsonCaso.data as CasoConRelaciones);
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

  const enlaceGestor = origin ? `${origin}/g/${caso.token_gestor}` : "";

  async function copiarMensajeGestor() {
    const registroTexto = caso.registro
      ? `${caso.registro.seccional ? `${caso.registro.seccional} ` : ""}N° ${caso.registro.numero}`
      : "sin asignar todavía";
    const mensaje = [
      `Se te asignó un nuevo caso: siniestro ${caso.numero_siniestro}.`,
      `Tipo de Baja: ${caso.tipo_baja?.nombre ?? "—"}`,
      `Dominio: ${caso.vehiculo?.dominio ?? "—"}`,
      `Asegurado: ${caso.asegurado?.nombre ?? "—"} - Contacto: ${caso.asegurado?.telefono ?? "—"}`,
      `Registro de radicación: ${registroTexto}`,
      `Entrá a este enlace para ver los datos y cargar la documentación: ${enlaceGestor}`
    ].join("\n");

    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function regenerarEnlaceGestor() {
    if (
      !confirm(
        "¿Regenerar el enlace? El enlace anterior va a dejar de funcionar para el gestor."
      )
    ) {
      return;
    }

    setRegenerando(true);
    const res = await fetch(`/api/casos/${caso.id}/regenerar-enlace-gestor`, {
      method: "POST"
    });
    setRegenerando(false);

    if (res.ok) {
      router.refresh();
    }
  }

  const registrosPorProvincia = (() => {
    const grupos = new Map<string, RegistroAutomotor[]>();
    for (const r of registros) {
      const clave = r.provincia || "Sin provincia";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(r);
    }
    return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            <span className="text-slate-400 font-normal">
              {caso.numero_caso === 0 ? "DEMO" : `N° ${caso.numero_caso}`} ·{" "}
            </span>
            Siniestro {caso.numero_siniestro}
            <span className={`badge ml-2 align-middle ${estadoBadgeClass(caso.estado)}`}>
              {ESTADOS.find((e) => e.value === caso.estado)?.label ?? caso.estado}
            </span>
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

      <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-x-8">
      <div className="lg:col-span-3 lg:order-1">
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

          <Field label="Aseguradora">
            {editing ? (
              <select
                className="input"
                value={form.aseguradora_id}
                onChange={(e) => update("aseguradora_id", e.target.value)}
              >
                {aseguradoras.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            ) : (
              caso.aseguradora?.nombre ?? "—"
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

          <Field label="Nombre de productor">
            {editing ? (
              <input
                className="input"
                value={form.productor_nombre}
                onChange={(e) => update("productor_nombre", e.target.value)}
              />
            ) : (
              caso.productor_nombre || "—"
            )}
          </Field>

          <Field label="Contacto de productor">
            {editing ? (
              <input
                className="input"
                value={form.productor_contacto}
                onChange={(e) => update("productor_contacto", e.target.value)}
              />
            ) : (
              caso.productor_contacto || "—"
            )}
          </Field>

          <Field label="Trámitador de la compañía">
            {editing ? (
              <input
                className="input"
                value={form.tramitador_nombre}
                onChange={(e) => update("tramitador_nombre", e.target.value)}
              />
            ) : (
              caso.tramitador_nombre || "—"
            )}
          </Field>

          <Field label="Email del trámitador">
            {editing ? (
              <input
                type="email"
                className="input"
                value={form.tramitador_email}
                onChange={(e) => update("tramitador_email", e.target.value)}
              />
            ) : (
              caso.tramitador_email || "—"
            )}
          </Field>
        </div>
      </Section>
      </div>

      <div className="lg:col-span-3 lg:order-3">
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
                {registrosPorProvincia.map(([provincia, regs]) => (
                  <optgroup key={provincia} label={provincia}>
                    {regs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.numero}
                        {r.seccional ? ` (${r.seccional})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : caso.registro ? (
              `${caso.registro.numero}${caso.registro.seccional ? ` (${caso.registro.seccional})` : ""}`
            ) : (
              "—"
            )}
          </Field>

          <Field label="Fecha de ingreso">
            {new Date(caso.fecha_ingreso + "T00:00:00").toLocaleDateString("es-AR")}
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
              new Date(caso.fecha_cierre + "T00:00:00").toLocaleDateString("es-AR")
            ) : (
              "—"
            )}
          </Field>
        </div>
      </Section>
      </div>

      <div className="lg:col-span-3 lg:order-5">
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
      </div>

      <div className="lg:col-span-2 lg:order-2">
      <Section title="Vehículo" firstInColumn>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
      </div>

      <div className="lg:col-span-2 lg:order-4">
      <Section title="Gestor de campo">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
          <Field label="Gestor asignado">
            {editing ? (
              <select
                className="input"
                value={form.gestor_id}
                onChange={(e) => update("gestor_id", e.target.value)}
              >
                <option value="">Sin asignar</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            ) : (
              caso.gestor?.nombre ?? "—"
            )}
          </Field>
        </div>

        {!soloLectura && !editing && caso.gestor_id && (
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-2">
            <div className="text-slate-500">
              Enlace para que {caso.gestor?.nombre} vea los datos del caso y cargue
              archivos, sin necesitar cuenta:
            </div>
            <div className="font-mono text-xs text-slate-700 break-all">
              {enlaceGestor || "Generando..."}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn-secondary" onClick={copiarMensajeGestor}>
                {copiado ? "¡Copiado!" : "Copiar mensaje"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={regenerando}
                onClick={regenerarEnlaceGestor}
              >
                {regenerando ? "Regenerando..." : "Regenerar enlace"}
              </button>
            </div>
          </div>
        )}

        {notificarGestor && (
          <SelectorNotificacion
            casoId={caso.id}
            caso={notificarGestor}
            tipo="gestor_asignado"
            onClose={() => setNotificarGestor(null)}
          />
        )}
      </Section>
      </div>

      <div className="lg:col-span-2 lg:order-6">
      <Section title="Datos económicos">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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

          <Field label="Valor InfoAuto">
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.valor_infoauto}
                onChange={(e) => update("valor_infoauto", Number(e.target.value))}
              />
            ) : (
              formatCurrency(caso.valor_infoauto)
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
      </div>
      </div>

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
  first,
  firstInColumn
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
  // Primero de su columna en el layout de dos columnas (lg:): lleva
  // separador cuando se apila en mobile, pero no en desktop, donde tiene
  // que arrancar a la misma altura que el título de la otra columna.
  firstInColumn?: boolean;
}) {
  const className = first
    ? ""
    : firstInColumn
    ? "mt-5 pt-5 border-t border-slate-100 lg:mt-0 lg:pt-0 lg:border-t-0"
    : "mt-5 pt-5 border-t border-slate-100";
  return (
    <div className={className}>
      <h3 className="font-heading text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="text-slate-800 break-words">{children}</div>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function estadoBadgeClass(estado: string) {
  switch (estado) {
    case "cerrado":
      return "bg-emerald-100 text-emerald-700";
    case "baja_en_tramite":
      return "bg-brand-100 text-brand-700";
    case "iniciado":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}
