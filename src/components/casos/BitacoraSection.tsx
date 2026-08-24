"use client";

import { useEffect, useState } from "react";
import { BitacoraEvento, CasoConRelaciones } from "@/types/database";
import { TIPOS_EVENTO, motivoBloqueo } from "@/lib/eventosBitacora";
import { TipoNotificacion } from "@/lib/email/notificacionesCaso";
import SelectorNotificacion from "./SelectorNotificacion";

const GESTORIA_NOMBRE = "Oltra Gestión Integral";
const EVENTO_LIBERACION_DOCUMENTAL = "Envío de documentación Cía";

// Eventos cuya finalización dispara la opción de notificar por mail a
// Tramitador/Productor/Asegurado (elegible cada vez, no es una
// configuración fija — ver SelectorNotificacion).
const EVENTO_A_NOTIFICACION: Record<string, TipoNotificacion> = {
  "Contacto con el asegurado": "contacto_asegurado",
  Traslado: "traslado",
  "Presentación de Baja": "presentacion_baja"
};

function mensajeContacto(caso: CasoConRelaciones): string {
  const nombreTitular = caso.asegurado?.nombre ?? "";
  const responsable = caso.responsable?.nombre ?? "";
  const aseguradora = caso.aseguradora?.nombre ?? "";
  const dominio = caso.vehiculo?.dominio ?? "";
  return `Hola ${nombreTitular}, buenas tardes. Te saluda ${responsable} de parte de la gestoría ${GESTORIA_NOMBRE} y su compañía de seguros ${aseguradora} por el siniestro N° ${caso.numero_siniestro} sobre el dominio ${dominio}. Quisiera contactar con vos dentro del horario en que se encuentre disponible y así poder brindarle la información de cómo se va a estar gestionando la baja de su unidad y el asesoramiento dentro del proceso en sí.`;
}

// wa.me necesita el número en formato internacional sin signos. Es un
// mejor esfuerzo (no siempre acierta el prefijo "9" de celulares
// argentinos) — por eso también se ofrece "Copiar mensaje" como respaldo.
function linkWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  if (!telefono) return null;
  let digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  if (!digitos.startsWith("54")) digitos = `54${digitos}`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

function MensajeContactoBox({ caso }: { caso: CasoConRelaciones }) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = mensajeContacto(caso);
  const link = linkWhatsapp(caso.asegurado?.telefono, mensaje);

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-2">
      <p className="text-slate-500">
        Mensaje sugerido para avisarle al asegurado antes de llamarlo (así no
        parece una estafa):
      </p>
      <p className="text-slate-700 whitespace-pre-wrap">{mensaje}</p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-secondary text-xs" onClick={copiar}>
          {copiado ? "¡Copiado!" : "Copiar mensaje"}
        </button>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
            Abrir WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function mensajeTraslado(
  caso: CasoConRelaciones,
  grueroNombre: string,
  enlace?: string | null
): string {
  const dominio = caso.vehiculo?.dominio ?? "";
  const vehiculo = [caso.vehiculo?.marca, caso.vehiculo?.modelo].filter(Boolean).join(" ");
  const responsable = caso.responsable?.nombre ?? "";
  const base = `Hola ${grueroNombre || ""}, te asignamos el traslado de la unidad ${
    vehiculo || "s/d"
  }, dominio ${dominio}, correspondiente al siniestro N° ${caso.numero_siniestro}. Cualquier consulta, contactate con ${responsable} de ${GESTORIA_NOMBRE}.`;
  return enlace
    ? `${base}\nAcá tenés la autorización y el informe de dominio: ${enlace}`
    : base;
}

function GrueroBox({
  caso,
  nombre,
  contacto,
  onNombreChange,
  onContactoChange,
  enlace
}: {
  caso: CasoConRelaciones;
  nombre: string;
  contacto: string;
  onNombreChange: (v: string) => void;
  onContactoChange: (v: string) => void;
  enlace?: string | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = mensajeTraslado(caso, nombre, enlace);
  const link = linkWhatsapp(contacto, mensaje);

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre del gruero</label>
          <input
            className="input"
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Contacto del gruero</label>
          <input
            className="input"
            value={contacto}
            placeholder="Teléfono"
            onChange={(e) => onContactoChange(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-slate-500">
          Mensaje sugerido para avisarle al gruero que le asignaron el traslado
          {!enlace && " (el enlace con la autorización y las fotos se agrega automáticamente después de guardar)"}
          :
        </p>
        <p className="text-slate-700 whitespace-pre-wrap">{mensaje}</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-secondary text-xs" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar mensaje"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              Abrir WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function mensajeFormularioBaja(
  caso: CasoConRelaciones,
  nombre: string,
  enlace?: string | null
): string {
  const dominio = caso.vehiculo?.dominio ?? "";
  const responsable = caso.responsable?.nombre ?? "";
  const base = `Hola ${
    nombre || ""
  }, ya se encuentra disponible en la carpeta del dominio toda la documentación necesaria para completar el formulario/carga 04D del siniestro N° ${caso.numero_siniestro} (dominio ${dominio}). Por favor completalo y cargalo en el sistema. Cualquier consulta, contactate con ${responsable} de ${GESTORIA_NOMBRE}.`;
  return enlace ? `${base}\nLo podés cargar acá: ${enlace}` : base;
}

function FormularioBajaBox({
  caso,
  nombre,
  contacto,
  onNombreChange,
  onContactoChange,
  enlace
}: {
  caso: CasoConRelaciones;
  nombre: string;
  contacto: string;
  onNombreChange: (v: string) => void;
  onContactoChange: (v: string) => void;
  enlace?: string | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = mensajeFormularioBaja(caso, nombre, enlace);
  const link = linkWhatsapp(contacto, mensaje);

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre de quien completa el 04D</label>
          <input
            className="input"
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Contacto</label>
          <input
            className="input"
            value={contacto}
            placeholder="Teléfono"
            onChange={(e) => onContactoChange(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-slate-500">
          Mensaje sugerido para avisarle que ya puede completar y cargar el formulario/04D
          {!enlace && " (el enlace de carga se agrega automáticamente después de guardar)"}:
        </p>
        <p className="text-slate-700 whitespace-pre-wrap">{mensaje}</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-secondary text-xs" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar mensaje"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              Abrir WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  casoId: string;
  caso: CasoConRelaciones;
  soloLectura?: boolean;
  casoSaldado?: boolean;
  esAdministrador?: boolean;
}

interface FormEvento {
  tipo_evento: string;
  observacion: string;
  es_interna: boolean;
  completado: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  gruero_nombre: string;
  gruero_contacto: string;
  formulario_baja_nombre: string;
  formulario_baja_contacto: string;
}

function formVacio(): FormEvento {
  return {
    tipo_evento: "",
    observacion: "",
    es_interna: false,
    completado: false,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: "",
    gruero_nombre: "",
    gruero_contacto: "",
    formulario_baja_nombre: "",
    formulario_baja_contacto: ""
  };
}

export default function BitacoraSection({
  casoId,
  caso,
  soloLectura,
  casoSaldado = true,
  esAdministrador = false
}: Props) {
  const [eventos, setEventos] = useState<BitacoraEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [origin, setOrigin] = useState("");

  // Control documental atado al estado financiero: completar "Envío de
  // documentación Cía" sin que el caso esté saldado requiere que un
  // administrador autorice una excepción con motivo.
  function necesitaExcepcionFinanciera(tipoEvento: string) {
    return tipoEvento === EVENTO_LIBERACION_DOCUMENTAL && !casoSaldado;
  }
  const [excepcionEventoId, setExcepcionEventoId] = useState<string | null>(null);
  const [excepcionMotivo, setExcepcionMotivo] = useState("");
  const [guardandoExcepcion, setGuardandoExcepcion] = useState(false);

  // Evento que se acaba de completar y para el que se puede ofrecer
  // notificar por mail (no bloquea nada — el evento ya quedó completado
  // igual, esto es un paso aparte y opcional).
  const [notificarEventoId, setNotificarEventoId] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormEvento>(formVacio());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormEvento>(formVacio());

  async function load() {
    const res = await fetch(`/api/casos/${casoId}/bitacora`);
    const json = await res.json();
    if (res.ok) setEventos(json.data);
    else setError(json.error);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.tipo_evento) {
      setError("Elegí un tipo de evento.");
      return;
    }

    if (form.completado) {
      const bloqueo = motivoBloqueo(form.tipo_evento, eventos ?? []);
      if (bloqueo) {
        setError(bloqueo);
        return;
      }
      if (necesitaExcepcionFinanciera(form.tipo_evento)) {
        if (!esAdministrador) {
          setError(
            "El caso no está saldado (todas las facturas cobradas). Solo un administrador puede autorizar una excepción para completar este evento."
          );
          return;
        }
        if (!excepcionMotivo.trim()) {
          setError("Cargá el motivo de la excepción financiera para poder completar este evento.");
          return;
        }
      }
    }

    setSaving(true);
    const res = await fetch(`/api/casos/${casoId}/bitacora`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: form.tipo_evento,
        observacion: form.observacion,
        es_interna: form.es_interna,
        completado: form.completado,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        ...(form.tipo_evento === "Traslado" && {
          gruero_nombre: form.gruero_nombre || null,
          gruero_contacto: form.gruero_contacto || null
        }),
        ...(form.tipo_evento === "Formulario de Baja" && {
          formulario_baja_nombre: form.formulario_baja_nombre || null,
          formulario_baja_contacto: form.formulario_baja_contacto || null
        }),
        ...(form.completado &&
          necesitaExcepcionFinanciera(form.tipo_evento) && {
            excepcion_financiera: true,
            motivo_excepcion: excepcionMotivo
          })
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error);
      return;
    }

    if (form.completado && EVENTO_A_NOTIFICACION[form.tipo_evento]) {
      setNotificarEventoId(json.data.id);
    }

    setForm(formVacio());
    setExcepcionMotivo("");
    setShowForm(false);
    load();
  }

  function empezarEdicion(ev: BitacoraEvento) {
    setError(null);
    setEditingId(ev.id);
    setEditForm({
      tipo_evento: ev.tipo_evento,
      observacion: ev.observacion ?? "",
      es_interna: ev.es_interna,
      completado: ev.completado,
      fecha_inicio: ev.fecha_inicio,
      fecha_fin: ev.fecha_fin ?? "",
      gruero_nombre: ev.gruero_nombre ?? "",
      gruero_contacto: ev.gruero_contacto ?? "",
      formulario_baja_nombre: ev.formulario_baja_nombre ?? "",
      formulario_baja_contacto: ev.formulario_baja_contacto ?? ""
    });
  }

  async function guardarEdicion(id: string) {
    setError(null);

    const yaEstabaCompletado = eventos?.find((ev) => ev.id === id)?.completado ?? false;
    const vaACompletarAhora = editForm.completado && !yaEstabaCompletado;

    if (editForm.completado) {
      const bloqueo = motivoBloqueo(editForm.tipo_evento, eventos ?? [], id);
      if (bloqueo) {
        setError(bloqueo);
        return;
      }
      if (vaACompletarAhora && necesitaExcepcionFinanciera(editForm.tipo_evento)) {
        if (!esAdministrador) {
          setError(
            "El caso no está saldado (todas las facturas cobradas). Solo un administrador puede autorizar una excepción para completar este evento."
          );
          return;
        }
        if (!excepcionMotivo.trim()) {
          setError("Cargá el motivo de la excepción financiera para poder completar este evento.");
          return;
        }
      }
    }

    setSaving(true);
    const res = await fetch(`/api/bitacora/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: editForm.tipo_evento,
        observacion: editForm.observacion,
        es_interna: editForm.es_interna,
        completado: editForm.completado,
        fecha_inicio: editForm.fecha_inicio,
        fecha_fin: editForm.fecha_fin || null,
        ...(editForm.tipo_evento === "Traslado" && {
          gruero_nombre: editForm.gruero_nombre || null,
          gruero_contacto: editForm.gruero_contacto || null
        }),
        ...(editForm.tipo_evento === "Formulario de Baja" && {
          formulario_baja_nombre: editForm.formulario_baja_nombre || null,
          formulario_baja_contacto: editForm.formulario_baja_contacto || null
        }),
        ...(vaACompletarAhora &&
          necesitaExcepcionFinanciera(editForm.tipo_evento) && {
            excepcion_financiera: true,
            motivo_excepcion: excepcionMotivo
          })
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error);
      return;
    }

    if (vaACompletarAhora && EVENTO_A_NOTIFICACION[editForm.tipo_evento]) {
      setNotificarEventoId(id);
    }

    setExcepcionMotivo("");
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string, tipoEvento: string) {
    if (!confirm(`¿Eliminar el evento "${tipoEvento}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/bitacora/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }
    load();
  }

  async function toggleCompletado(evento: BitacoraEvento) {
    setError(null);
    const vaACompletar = !evento.completado;

    if (vaACompletar) {
      const bloqueo = motivoBloqueo(evento.tipo_evento, eventos ?? [], evento.id);
      if (bloqueo) {
        setError(bloqueo);
        return;
      }
      if (necesitaExcepcionFinanciera(evento.tipo_evento)) {
        if (!esAdministrador) {
          setError(
            "El caso no está saldado (todas las facturas cobradas). Solo un administrador puede autorizar una excepción para completar este evento."
          );
          return;
        }
        // En vez de completar directo, se abre el cuadro para cargar el
        // motivo de la excepción (ver confirmarExcepcion más abajo).
        setExcepcionEventoId(evento.id);
        setExcepcionMotivo("");
        return;
      }
    }

    const res = await fetch(`/api/bitacora/${evento.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completado: vaACompletar })
    });
    const json = await res.json();
    if (res.ok) {
      if (vaACompletar && EVENTO_A_NOTIFICACION[evento.tipo_evento]) {
        setNotificarEventoId(evento.id);
      }
      load();
    } else {
      setError(json.error);
    }
  }

  async function confirmarExcepcion(eventoId: string) {
    if (!excepcionMotivo.trim()) {
      setError("Cargá el motivo de la excepción financiera.");
      return;
    }
    setError(null);
    setGuardandoExcepcion(true);
    try {
      const res = await fetch(`/api/bitacora/${eventoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completado: true,
          excepcion_financiera: true,
          motivo_excepcion: excepcionMotivo
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setExcepcionEventoId(null);
      setExcepcionMotivo("");
      load();
    } finally {
      setGuardandoExcepcion(false);
    }
  }

  const tiposYaCargados = new Set((eventos ?? []).map((ev) => ev.tipo_evento));
  const tiposDisponiblesNuevo = TIPOS_EVENTO.filter(
    (t) => t.label === "Observaciones" || !tiposYaCargados.has(t.label)
  );

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-medium text-slate-800">Bitácora</h2>
        {!soloLectura && (
          <button className="btn-secondary text-xs" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancelar" : "+ Agregar evento"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 border-b border-slate-100 pb-4">
          <div>
            <label className="label">Tipo de evento *</label>
            <select
              required
              className="input"
              value={form.tipo_evento}
              onChange={(e) => setForm((f) => ({ ...f, tipo_evento: e.target.value }))}
            >
              <option value="">Seleccionar...</option>
              {tiposDisponiblesNuevo.map((t) => (
                <option key={t.value} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {form.tipo_evento === "Contacto con el asegurado" && (
            <MensajeContactoBox caso={caso} />
          )}
          {form.tipo_evento === "Traslado" && (
            <GrueroBox
              caso={caso}
              nombre={form.gruero_nombre}
              contacto={form.gruero_contacto}
              onNombreChange={(v) => setForm((f) => ({ ...f, gruero_nombre: v }))}
              onContactoChange={(v) => setForm((f) => ({ ...f, gruero_contacto: v }))}
            />
          )}
          {form.tipo_evento === "Formulario de Baja" && (
            <FormularioBajaBox
              caso={caso}
              nombre={form.formulario_baja_nombre}
              contacto={form.formulario_baja_contacto}
              onNombreChange={(v) => setForm((f) => ({ ...f, formulario_baja_nombre: v }))}
              onContactoChange={(v) => setForm((f) => ({ ...f, formulario_baja_contacto: v }))}
            />
          )}
          <div>
            <label className="label">Observación</label>
            <textarea
              className="input"
              rows={2}
              value={form.observacion}
              onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="label">Fecha inicio</label>
              <input
                type="date"
                className="input"
                value={form.fecha_inicio}
                onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Fecha fin</label>
              <input
                type="date"
                className="input"
                value={form.fecha_fin}
                onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.es_interna}
                onChange={(e) => setForm((f) => ({ ...f, es_interna: e.target.checked }))}
              />
              Observación interna
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.completado}
                onChange={(e) => setForm((f) => ({ ...f, completado: e.target.checked }))}
              />
              Completada
            </label>
          </div>
          {form.completado && necesitaExcepcionFinanciera(form.tipo_evento) && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm space-y-2">
              {esAdministrador ? (
                <>
                  <p className="text-amber-800">
                    El caso no está saldado. Para completar este evento igual, cargá el motivo de
                    la excepción financiera.
                  </p>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Motivo de la excepción"
                    value={excepcionMotivo}
                    onChange={(e) => setExcepcionMotivo(e.target.value)}
                  />
                </>
              ) : (
                <p className="text-amber-800">
                  El caso no está saldado (todas las facturas cobradas). Solo un administrador
                  puede autorizar una excepción para completar este evento.
                </p>
              )}
            </div>
          )}
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar evento"}
          </button>
        </form>
      )}

      <ul className="space-y-3 max-h-[28rem] overflow-y-auto">
        {eventos?.map((ev) => {
          const enEdicion = editingId === ev.id;
          const observacionOculta = ev.es_interna && ev.observacion === null;

          if (enEdicion) {
            return (
              <li key={ev.id} className="border border-brand-200 bg-brand-50/40 rounded-lg p-3 text-sm space-y-3">
                <div>
                  <label className="label">Tipo de evento</label>
                  <select
                    className="input"
                    value={editForm.tipo_evento}
                    onChange={(e) => setEditForm((f) => ({ ...f, tipo_evento: e.target.value }))}
                  >
                    {tiposDisponiblesNuevo.map((t) => (
                      <option key={t.value} value={t.label}>
                        {t.label}
                      </option>
                    ))}
                    {!tiposDisponiblesNuevo.some((t) => t.label === editForm.tipo_evento) && (
                      <option value={editForm.tipo_evento}>{editForm.tipo_evento}</option>
                    )}
                  </select>
                </div>
                {editForm.tipo_evento === "Contacto con el asegurado" && (
                  <MensajeContactoBox caso={caso} />
                )}
                {editForm.tipo_evento === "Traslado" && (
                  <GrueroBox
                    caso={caso}
                    nombre={editForm.gruero_nombre}
                    contacto={editForm.gruero_contacto}
                    onNombreChange={(v) => setEditForm((f) => ({ ...f, gruero_nombre: v }))}
                    onContactoChange={(v) => setEditForm((f) => ({ ...f, gruero_contacto: v }))}
                    enlace={origin ? `${origin}/gr/${ev.token_gruero}` : null}
                  />
                )}
                {editForm.tipo_evento === "Formulario de Baja" && (
                  <FormularioBajaBox
                    caso={caso}
                    nombre={editForm.formulario_baja_nombre}
                    contacto={editForm.formulario_baja_contacto}
                    onNombreChange={(v) => setEditForm((f) => ({ ...f, formulario_baja_nombre: v }))}
                    onContactoChange={(v) =>
                      setEditForm((f) => ({ ...f, formulario_baja_contacto: v }))
                    }
                    enlace={origin ? `${origin}/fb/${ev.token_formulario_baja}` : null}
                  />
                )}
                <div>
                  <label className="label">Observación</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={editForm.observacion}
                    onChange={(e) => setEditForm((f) => ({ ...f, observacion: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="label">Fecha inicio</label>
                    <input
                      type="date"
                      className="input"
                      value={editForm.fecha_inicio}
                      onChange={(e) => setEditForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha fin</label>
                    <input
                      type="date"
                      className="input"
                      value={editForm.fecha_fin}
                      onChange={(e) => setEditForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.es_interna}
                      onChange={(e) => setEditForm((f) => ({ ...f, es_interna: e.target.checked }))}
                    />
                    Observación interna
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.completado}
                      onChange={(e) => setEditForm((f) => ({ ...f, completado: e.target.checked }))}
                    />
                    Completada
                  </label>
                </div>
                {editForm.completado &&
                  !ev.completado &&
                  necesitaExcepcionFinanciera(editForm.tipo_evento) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                      {esAdministrador ? (
                        <>
                          <p className="text-amber-800">
                            El caso no está saldado. Para completar este evento igual, cargá el
                            motivo de la excepción financiera.
                          </p>
                          <textarea
                            className="input"
                            rows={2}
                            placeholder="Motivo de la excepción"
                            value={excepcionMotivo}
                            onChange={(e) => setExcepcionMotivo(e.target.value)}
                          />
                        </>
                      ) : (
                        <p className="text-amber-800">
                          El caso no está saldado (todas las facturas cobradas). Solo un
                          administrador puede autorizar una excepción para completar este evento.
                        </p>
                      )}
                    </div>
                  )}
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs"
                    disabled={saving}
                    onClick={() => guardarEdicion(ev.id)}
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
            <li key={ev.id} className="border border-slate-100 rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {ev.tipo_evento}
                    {ev.es_interna && (
                      <span className="badge bg-slate-100 text-slate-500 ml-2">interna</span>
                    )}
                    {ev.excepcion_financiera && (
                      <span
                        className="badge bg-amber-100 text-amber-700 ml-2"
                        title={ev.motivo_excepcion ?? undefined}
                      >
                        Excepción financiera
                      </span>
                    )}
                  </p>
                  {ev.excepcion_financiera && ev.motivo_excepcion && (
                    <p className="text-xs text-amber-700 italic">
                      Motivo: {ev.motivo_excepcion}
                    </p>
                  )}
                  {observacionOculta ? (
                    <p className="text-slate-400 italic">
                      🔒 Observación interna (visible solo para el responsable del caso)
                    </p>
                  ) : (
                    ev.observacion && (
                      <p className="text-slate-600 whitespace-pre-wrap">{ev.observacion}</p>
                    )
                  )}
                  {ev.tipo_evento === "Traslado" && ev.gruero_nombre && (
                    <p className="text-slate-500">
                      🚚 Gruero: {ev.gruero_nombre}
                      {ev.gruero_contacto && ` · ${ev.gruero_contacto}`}
                    </p>
                  )}
                  {ev.tipo_evento === "Formulario de Baja" && ev.formulario_baja_nombre && (
                    <p className="text-slate-500">
                      📄 Formulario de Baja: {ev.formulario_baja_nombre}
                      {ev.formulario_baja_contacto && ` · ${ev.formulario_baja_contacto}`}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(ev.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                    {ev.fecha_fin &&
                      ` → ${new Date(ev.fecha_fin + "T00:00:00").toLocaleDateString("es-AR")}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {soloLectura ? (
                    <span
                      className={`badge ${
                        ev.completado
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ev.completado ? "Completada" : "Pendiente"}
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleCompletado(ev)}
                      className={`badge ${
                        ev.completado
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ev.completado ? "Completada" : "Pendiente"}
                    </button>
                  )}
                  {!observacionOculta && !soloLectura && (
                    <button
                      className="text-xs text-slate-400 hover:text-brand-700"
                      onClick={() => empezarEdicion(ev)}
                    >
                      Editar
                    </button>
                  )}
                  {!soloLectura && (
                    <button
                      className="text-xs text-slate-400 hover:text-red-600"
                      onClick={() => handleDelete(ev.id, ev.tipo_evento)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
              {excepcionEventoId === ev.id && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm space-y-2">
                  <p className="text-amber-800">
                    El caso no está saldado. Cargá el motivo de la excepción financiera para
                    completar este evento igual.
                  </p>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Motivo de la excepción"
                    value={excepcionMotivo}
                    onChange={(e) => setExcepcionMotivo(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-xs"
                      disabled={guardandoExcepcion}
                      onClick={() => confirmarExcepcion(ev.id)}
                    >
                      {guardandoExcepcion ? "Guardando..." : "Completar con excepción financiera"}
                    </button>
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setExcepcionEventoId(null);
                        setExcepcionMotivo("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {notificarEventoId === ev.id && EVENTO_A_NOTIFICACION[ev.tipo_evento] && (
                <SelectorNotificacion
                  casoId={casoId}
                  caso={caso}
                  tipo={EVENTO_A_NOTIFICACION[ev.tipo_evento]}
                  onClose={() => setNotificarEventoId(null)}
                />
              )}
            </li>
          );
        })}
        {eventos?.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay eventos cargados.</p>
        )}
      </ul>
    </section>
  );
}
