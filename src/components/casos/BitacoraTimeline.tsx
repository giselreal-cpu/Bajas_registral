"use client";

import { useEffect, useState } from "react";
import { BitacoraEvento, CasoConRelaciones } from "@/types/database";
import { EVENTOS_SOLO_INFORMES, TIPOS_EVENTO, esSoloInformes, motivoBloqueo } from "@/lib/eventosBitacora";
import { GrueroBox, FormularioBajaBox, EVENTO_A_NOTIFICACION } from "./BitacoraSection";
import SelectorNotificacion from "./SelectorNotificacion";

// Los pasos fijos del timeline móvil son el catálogo real menos
// "Observaciones" (no es un hito de avance sino un registro libre y
// repetible). El orden de TIPOS_EVENTO no sirve tal cual para mostrarlo
// como secuencia: ahí "Cierre de Caso" queda antes de "Baja de Patentes"
// porque el cierre no depende de esa (ver `requiere` en eventosBitacora.ts),
// pero en la práctica el cierre es siempre el último paso — se reordena acá
// solo para esta vista, sin tocar el catálogo compartido.
const ORDEN_TIMELINE = [
  "ingreso_caso",
  "peticion_informes",
  "revision_documentacion",
  "contacto_asegurado",
  "autorizacion_traslado",
  "asignacion_desarmadero",
  "traslado",
  "formulario_baja",
  "presentacion_baja",
  "envio_documentacion_cia",
  "baja_patentes",
  "cierre_caso"
];
const PASOS = ORDEN_TIMELINE.map((v) => TIPOS_EVENTO.find((t) => t.value === v)).filter(
  (t): t is NonNullable<typeof t> => !!t
);

interface Props {
  casoId: string;
  caso: CasoConRelaciones;
  soloLectura?: boolean;
  // Nombre del tipo de baja del caso: "Solo Informes" tiene una secuencia
  // corta propia (sin gestor, traslado, formularios ni presentación).
  tipoBaja?: string | null;
}

interface DatosGruero {
  nombre: string;
  contacto: string;
  localidad: string;
}

interface DatosFormularioBaja {
  nombre: string;
  contacto: string;
}

interface EditFormState {
  observacion: string;
  es_interna: boolean;
  completado: boolean;
  fecha_inicio: string;
  fecha_fin: string;
}

function formVacio(ev: BitacoraEvento): EditFormState {
  return {
    observacion: ev.observacion ?? "",
    es_interna: ev.es_interna,
    completado: ev.completado,
    fecha_inicio: ev.fecha_inicio,
    fecha_fin: ev.fecha_fin ?? ""
  };
}

// Componente propio (no anidado en el render del padre): si se define
// adentro de BitacoraTimeline, React lo trata como un tipo nuevo en
// cada re-render (p. ej. cada tecla tipeada en la observación) y
// desmonta/remonta el formulario entero, dejando "Guardar" con un
// listener sobre un nodo del DOM ya descartado — el click deja de
// hacer nada, sin ningún error visible.
function EditForm({
  editForm,
  setEditForm,
  saving,
  onCancelar,
  onGuardar
}: {
  editForm: EditFormState;
  setEditForm: (updater: (f: EditFormState) => EditFormState) => void;
  saving: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  return (
    <div
      className="mt-1.5 p-2.5 space-y-2"
      style={{ background: "var(--mv-neutral-100)", borderRadius: "var(--mv-radius-md)" }}
    >
      <textarea
        className="mv-input"
        rows={2}
        placeholder="Observación"
        value={editForm.observacion}
        onChange={(e) => setEditForm((f) => ({ ...f, observacion: e.target.value }))}
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[11px]" style={{ color: "var(--mv-neutral-600)" }}>
            Fecha
          </label>
          <input
            type="date"
            className="mv-input"
            value={editForm.fecha_inicio}
            onChange={(e) => setEditForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
          />
        </div>
        <div className="flex-1">
          <label className="text-[11px]" style={{ color: "var(--mv-neutral-600)" }}>
            Vence (opcional)
          </label>
          <input
            type="date"
            className="mv-input"
            value={editForm.fecha_fin}
            onChange={(e) => setEditForm((f) => ({ ...f, fecha_fin: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--mv-neutral-700)" }}>
          <input
            type="checkbox"
            checked={editForm.completado}
            onChange={(e) => setEditForm((f) => ({ ...f, completado: e.target.checked }))}
          />
          Completado
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--mv-neutral-700)" }}>
          <input
            type="checkbox"
            checked={editForm.es_interna}
            onChange={(e) => setEditForm((f) => ({ ...f, es_interna: e.target.checked }))}
          />
          Interna
        </label>
      </div>
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          className="mv-btn mv-btn-secondary text-xs px-3 py-1.5 flex-1"
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="mv-btn mv-btn-primary text-xs px-3 py-1.5 flex-1"
          disabled={saving}
          onClick={onGuardar}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export default function BitacoraTimeline({ casoId, caso, soloLectura, tipoBaja }: Props) {
  const PASOS_CASO = esSoloInformes(tipoBaja)
    ? PASOS.filter((p) => EVENTOS_SOLO_INFORMES.includes(p.label))
    : PASOS.filter((p) => p.value !== "revision_documentacion");
  const [eventos, setEventos] = useState<BitacoraEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdicion, setSavingEdicion] = useState(false);
  const [origin, setOrigin] = useState("");
  // Evento para el que se está mostrando el recuadro "Notificar por mail a:"
  // (se abre solo al completar un evento con aviso, o con "Avisar por mail").
  const [avisarEventoId, setAvisarEventoId] = useState<string | null>(null);

  // Datos de gruero/formulario de baja mientras todavía no se guardaron:
  // una vez que el evento existe (se insertó, completado o no), se
  // muestran los valores guardados y el enlace público real en vez de
  // este borrador local.
  const [datosGruero, setDatosGruero] = useState<DatosGruero>({ nombre: "", contacto: "", localidad: "" });
  const [datosFormularioBaja, setDatosFormularioBaja] = useState<DatosFormularioBaja>({ nombre: "", contacto: "" });
  const [guardandoContacto, setGuardandoContacto] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/casos/${casoId}/bitacora`);
      const json = await res.json();
      if (res.ok) setEventos(json.data);
      else setError(json.error);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId]);

  async function completar(label: string, eventoExistente?: BitacoraEvento) {
    setError(null);
    setSavingLabel(label);
    try {
      const res = eventoExistente
        ? await fetch(`/api/bitacora/${eventoExistente.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completado: true })
          })
        : await fetch(`/api/casos/${casoId}/bitacora`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo_evento: label,
              observacion: "",
              es_interna: false,
              completado: true,
              fecha_inicio: new Date().toISOString().slice(0, 10),
              fecha_fin: null
            })
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      // Los eventos con aviso por mail abren el recuadro de destinatarios.
      const idEvento = eventoExistente?.id ?? json.data?.id;
      if (idEvento && EVENTO_A_NOTIFICACION[label]) setAvisarEventoId(idEvento);
      load();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSavingLabel(null);
    }
  }

  // Guarda (o actualiza) los datos del gruero sin marcar el evento como
  // completado — así el enlace público (/gr/<token>) queda disponible
  // para copiar y mandar apenas se inicia el traslado, no solo al
  // completarlo.
  async function guardarGruero(eventoExistente: BitacoraEvento | undefined, datos: DatosGruero) {
    setError(null);
    setGuardandoContacto("Traslado");
    try {
      const res = eventoExistente
        ? await fetch(`/api/bitacora/${eventoExistente.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gruero_nombre: datos.nombre,
              gruero_contacto: datos.contacto,
              traslado_localidad: datos.localidad
            })
          })
        : await fetch(`/api/casos/${casoId}/bitacora`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo_evento: "Traslado",
              observacion: "",
              es_interna: false,
              completado: false,
              fecha_inicio: new Date().toISOString().slice(0, 10),
              fecha_fin: null,
              gruero_nombre: datos.nombre,
              gruero_contacto: datos.contacto,
              traslado_localidad: datos.localidad
            })
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setDatosGruero({ nombre: "", contacto: "", localidad: "" });
      load();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setGuardandoContacto(null);
    }
  }

  // Mismo criterio que guardarGruero, para el Formulario de Baja
  // (/fb/<token>).
  async function guardarFormularioBaja(
    eventoExistente: BitacoraEvento | undefined,
    datos: DatosFormularioBaja
  ) {
    setError(null);
    setGuardandoContacto("Formulario de Baja");
    try {
      const res = eventoExistente
        ? await fetch(`/api/bitacora/${eventoExistente.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              formulario_baja_nombre: datos.nombre,
              formulario_baja_contacto: datos.contacto
            })
          })
        : await fetch(`/api/casos/${casoId}/bitacora`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo_evento: "Formulario de Baja",
              observacion: "",
              es_interna: false,
              completado: false,
              fecha_inicio: new Date().toISOString().slice(0, 10),
              fecha_fin: null,
              formulario_baja_nombre: datos.nombre,
              formulario_baja_contacto: datos.contacto
            })
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setDatosFormularioBaja({ nombre: "", contacto: "" });
      load();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setGuardandoContacto(null);
    }
  }

  function empezarEdicion(ev: BitacoraEvento) {
    setError(null);
    setEditingId(ev.id);
    setEditForm(formVacio(ev));
  }

  function cancelarEdicion() {
    setEditingId(null);
    setEditForm(null);
  }

  async function guardarEdicion(id: string) {
    if (!editForm) return;
    setError(null);
    setSavingEdicion(true);
    try {
      const res = await fetch(`/api/bitacora/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacion: editForm.observacion,
          es_interna: editForm.es_interna,
          completado: editForm.completado,
          fecha_inicio: editForm.fecha_inicio,
          fecha_fin: editForm.fecha_fin || null
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      const evEditado = (eventos ?? []).find((e) => e.id === id);
      if (evEditado && !evEditado.completado && editForm.completado && EVENTO_A_NOTIFICACION[evEditado.tipo_evento]) {
        setAvisarEventoId(id);
      }
      cancelarEdicion();
      load();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSavingEdicion(false);
    }
  }

  if (!eventos) {
    return <p className="text-sm text-slate-500 p-1">Cargando bitácora...</p>;
  }

  const completados = PASOS_CASO.filter((p) =>
    eventos.some((ev) => ev.tipo_evento === p.label && ev.completado)
  ).length;

  // "Observaciones" es de carga libre y repetible (no un paso fijo del
  // checklist de arriba), así que se lista aparte, más reciente primero.
  const observaciones = eventos
    .filter((ev) => ev.tipo_evento === "Observaciones")
    .sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? 1 : -1));

  return (
    <div>
      <p className="text-xs mb-3 tabular-nums" style={{ color: "var(--mv-neutral-600)" }}>
        {completados} de {PASOS_CASO.length} eventos completados
      </p>

      {error && (
        <div
          className="mb-3 text-sm rounded-md p-3"
          style={{ color: "var(--mv-accent-700)", background: "var(--mv-accent-100)" }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col">
        {PASOS_CASO.map((paso, i) => {
          const ev = eventos.find((e) => e.tipo_evento === paso.label);
          const completado = !!ev?.completado;
          const bloqueo = !completado ? motivoBloqueo(paso.label, eventos, undefined, tipoBaja) : null;
          const esUltimo = i === PASOS_CASO.length - 1;
          const enEdicion = ev && editingId === ev.id;

          return (
            <div key={paso.value} className="flex gap-3">
              <div className="flex flex-col items-center w-[18px] shrink-0">
                <span
                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                  style={
                    completado
                      ? { background: "var(--mv-accent)" }
                      : { background: "#fff", border: "1px solid var(--mv-neutral-400)" }
                  }
                />
                {!esUltimo && (
                  <span className="flex-1 w-px my-1" style={{ background: "var(--mv-divider)" }} />
                )}
              </div>
              <div className={`min-w-0 flex-1 ${esUltimo ? "pb-1" : "pb-4"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mv-heading text-[15px] tracking-tight">{paso.label}</span>
                  {ev && (
                    <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--mv-neutral-600)" }}>
                      {new Date(ev.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
                {!soloLectura && !enEdicion && ev?.observacion && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-700)" }}>
                    {ev.observacion}
                  </p>
                )}
                {!soloLectura && !enEdicion && !completado && paso.label === "Traslado" && (
                  <div className="mt-1.5">
                    <GrueroBox
                      caso={caso}
                      nombre={ev?.gruero_nombre ?? datosGruero.nombre}
                      contacto={ev?.gruero_contacto ?? datosGruero.contacto}
                      localidad={ev?.traslado_localidad ?? datosGruero.localidad}
                      onNombreChange={(v) => setDatosGruero((d) => ({ ...d, nombre: v }))}
                      onContactoChange={(v) => setDatosGruero((d) => ({ ...d, contacto: v }))}
                      onLocalidadChange={(v) => setDatosGruero((d) => ({ ...d, localidad: v }))}
                      enlace={ev && origin ? `${origin}/gr/${ev.token_gruero}` : null}
                    />
                    <button
                      type="button"
                      disabled={guardandoContacto === "Traslado"}
                      onClick={() =>
                        guardarGruero(ev, {
                          nombre: ev?.gruero_nombre ?? datosGruero.nombre,
                          contacto: ev?.gruero_contacto ?? datosGruero.contacto,
                          localidad: ev?.traslado_localidad ?? datosGruero.localidad
                        })
                      }
                      className="mv-heading text-xs px-2.5 py-1 rounded-md disabled:opacity-50 mt-2"
                      style={{ border: "1px solid var(--mv-accent)", color: "var(--mv-accent-700)" }}
                    >
                      {guardandoContacto === "Traslado"
                        ? "Guardando..."
                        : ev
                        ? "Guardar datos del gruero"
                        : "Iniciar traslado y generar enlace"}
                    </button>
                  </div>
                )}
                {!soloLectura && !enEdicion && !completado && paso.label === "Formulario de Baja" && (
                  <div className="mt-1.5">
                    <FormularioBajaBox
                      caso={caso}
                      nombre={ev?.formulario_baja_nombre ?? datosFormularioBaja.nombre}
                      contacto={ev?.formulario_baja_contacto ?? datosFormularioBaja.contacto}
                      onNombreChange={(v) => setDatosFormularioBaja((d) => ({ ...d, nombre: v }))}
                      onContactoChange={(v) => setDatosFormularioBaja((d) => ({ ...d, contacto: v }))}
                      enlace={ev && origin ? `${origin}/fb/${ev.token_formulario_baja}` : null}
                    />
                    <button
                      type="button"
                      disabled={guardandoContacto === "Formulario de Baja"}
                      onClick={() =>
                        guardarFormularioBaja(ev, {
                          nombre: ev?.formulario_baja_nombre ?? datosFormularioBaja.nombre,
                          contacto: ev?.formulario_baja_contacto ?? datosFormularioBaja.contacto
                        })
                      }
                      className="mv-heading text-xs px-2.5 py-1 rounded-md disabled:opacity-50 mt-2"
                      style={{ border: "1px solid var(--mv-accent)", color: "var(--mv-accent-700)" }}
                    >
                      {guardandoContacto === "Formulario de Baja"
                        ? "Guardando..."
                        : ev
                        ? "Guardar datos"
                        : "Iniciar formulario y generar enlace"}
                    </button>
                  </div>
                )}
                {enEdicion && ev && editForm ? (
                  <EditForm
                    editForm={editForm}
                    setEditForm={(updater) => setEditForm((f) => (f ? updater(f) : f))}
                    saving={savingEdicion}
                    onCancelar={cancelarEdicion}
                    onGuardar={() => guardarEdicion(ev.id)}
                  />
                ) : (
                  <div className="mt-1.5 flex items-center gap-3">
                    {!completado &&
                      !soloLectura &&
                      (bloqueo ? (
                        <span className="text-xs" style={{ color: "var(--mv-neutral-500)" }}>
                          {bloqueo}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={savingLabel === paso.label}
                          onClick={() => completar(paso.label, ev)}
                          className="mv-heading text-xs px-2.5 py-1 rounded-md disabled:opacity-50"
                          style={{ border: "1px solid var(--mv-accent)", color: "var(--mv-accent-700)" }}
                        >
                          {savingLabel === paso.label ? "Guardando..." : "Marcar completado"}
                        </button>
                      ))}
                    {!soloLectura && ev && completado && EVENTO_A_NOTIFICACION[paso.label] && (
                      <button
                        type="button"
                        className="text-xs"
                        style={{ color: "var(--mv-accent-700)" }}
                        onClick={() => setAvisarEventoId((id) => (id === ev.id ? null : ev.id))}
                      >
                        Avisar por mail
                      </button>
                    )}
                    {!soloLectura && ev && (
                      <button
                        type="button"
                        className="text-xs"
                        style={{ color: "var(--mv-neutral-500)" }}
                        onClick={() => empezarEdicion(ev)}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
                {!soloLectura && ev && avisarEventoId === ev.id && EVENTO_A_NOTIFICACION[paso.label] && (
                  <SelectorNotificacion
                    casoId={casoId}
                    caso={caso}
                    tipo={EVENTO_A_NOTIFICACION[paso.label]}
                    onClose={() => setAvisarEventoId(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {observaciones.length > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--mv-divider)" }}>
          <p className="mv-heading text-[13px] mb-2" style={{ color: "var(--mv-neutral-600)" }}>
            Observaciones
          </p>
          <div className="flex flex-col gap-3">
            {observaciones.map((ev) => {
              const enEdicion = editingId === ev.id;
              return (
                <div key={ev.id}>
                  <span className="text-[11.5px] tabular-nums" style={{ color: "var(--mv-neutral-600)" }}>
                    {new Date(ev.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                  </span>
                  {!enEdicion && ev.observacion && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-700)" }}>
                      {ev.observacion}
                    </p>
                  )}
                  {enEdicion && editForm ? (
                    <EditForm
                      editForm={editForm}
                      setEditForm={(updater) => setEditForm((f) => (f ? updater(f) : f))}
                      saving={savingEdicion}
                      onCancelar={cancelarEdicion}
                      onGuardar={() => guardarEdicion(ev.id)}
                    />
                  ) : (
                    !soloLectura && (
                      <button
                        type="button"
                        className="text-xs mt-1"
                        style={{ color: "var(--mv-neutral-500)" }}
                        onClick={() => empezarEdicion(ev)}
                      >
                        Editar
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
