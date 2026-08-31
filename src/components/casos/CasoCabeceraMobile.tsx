"use client";

import { ESTADOS, RAMAS } from "@/types/database";
import { estadoBadgeClass } from "@/lib/estadoBadge";
import { CasoCabeceraProps, formatCurrency, useCasoCabecera } from "./useCasoCabecera";
import SelectorNotificacion from "./SelectorNotificacion";

export default function CasoCabeceraMobile(props: CasoCabeceraProps) {
  const { caso, aseguradoras, registros, tiposBaja, usuarios, gestores, soloLectura, esAdministrador } =
    props;
  const {
    editing,
    setEditing,
    saving,
    deleting,
    error,
    setError,
    copiado,
    regenerando,
    notificarGestor,
    setNotificarGestor,
    form,
    update,
    handleSave,
    handleDelete,
    enlaceGestor,
    copiarMensajeGestor,
    regenerarEnlaceGestor,
    registrosPorProvincia
  } = useCasoCabecera(props);

  const estadoAbierto = caso.estado !== "cerrado";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className={`mv-badge ${estadoAbierto ? "" : "mv-badge-closed"}`}>
          {ESTADOS.find((e) => e.value === caso.estado)?.label ?? caso.estado}
        </span>
        {!editing ? (
          <div className="flex gap-2">
            {!soloLectura && (
              <button className="mv-btn mv-btn-secondary text-xs px-3 py-1.5" onClick={() => setEditing(true)}>
                Editar
              </button>
            )}
            {esAdministrador && (
              <button
                className="mv-btn text-xs px-3 py-1.5"
                style={{ border: "1px solid #c0392b", color: "#c0392b" }}
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              className="mv-btn mv-btn-secondary text-xs px-3 py-1.5"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            <button className="mv-btn mv-btn-primary text-xs px-3 py-1.5" disabled={saving} onClick={handleSave}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mb-4 text-sm rounded-md p-3"
          style={{ color: "var(--mv-accent-700)", background: "var(--mv-accent-100)" }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <MobileSection title="Datos del caso">
          <Row label="N° de siniestro">
            {editing ? (
              <input className="mv-input" value={form.numero_siniestro} onChange={(e) => update("numero_siniestro", e.target.value)} />
            ) : (
              caso.numero_siniestro
            )}
          </Row>
          <Row label="N° de póliza">
            {editing ? (
              <input className="mv-input" value={form.numero_poliza} onChange={(e) => update("numero_poliza", e.target.value)} />
            ) : (
              caso.numero_poliza || "—"
            )}
          </Row>
          <Row label="Aseguradora">
            {editing ? (
              <select className="mv-input" value={form.aseguradora_id} onChange={(e) => update("aseguradora_id", e.target.value)}>
                {aseguradoras.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            ) : (
              caso.aseguradora?.nombre ?? "—"
            )}
          </Row>
          <Row label="Tipo de baja">
            {editing ? (
              <select className="mv-input" value={form.tipo_baja_id} onChange={(e) => update("tipo_baja_id", e.target.value)}>
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
          </Row>
          <Row label="Responsable">
            {editing ? (
              <select className="mv-input" value={form.responsable_id} onChange={(e) => update("responsable_id", e.target.value)}>
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
          </Row>
          <Row label="Nombre de productor">
            {editing ? (
              <input className="mv-input" value={form.productor_nombre} onChange={(e) => update("productor_nombre", e.target.value)} />
            ) : (
              caso.productor_nombre || "—"
            )}
          </Row>
          <Row label="Contacto de productor">
            {editing ? (
              <input className="mv-input" value={form.productor_contacto} onChange={(e) => update("productor_contacto", e.target.value)} />
            ) : (
              caso.productor_contacto || "—"
            )}
          </Row>
          <Row label="Trámitador de la Cía">
            {editing ? (
              <input className="mv-input" value={form.tramitador_nombre} onChange={(e) => update("tramitador_nombre", e.target.value)} />
            ) : (
              caso.tramitador_nombre || "—"
            )}
          </Row>
          <Row label="Email del trámitador" last>
            {editing ? (
              <input
                type="email"
                className="mv-input"
                value={form.tramitador_email}
                onChange={(e) => update("tramitador_email", e.target.value)}
              />
            ) : (
              caso.tramitador_email || "—"
            )}
          </Row>
        </MobileSection>

        <MobileSection title="Trámite">
          <Row label="Rama">
            {editing ? (
              <select className="mv-input" value={form.rama} onChange={(e) => update("rama", e.target.value)}>
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
          </Row>
          <Row label="Tipo de trámite">
            {editing ? (
              <select className="mv-input" value={form.tipo_tramite} onChange={(e) => update("tipo_tramite", e.target.value)}>
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
          </Row>
          <Row label="Registro automotor">
            {editing ? (
              <select className="mv-input" value={form.registro_id} onChange={(e) => update("registro_id", e.target.value)}>
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
          </Row>
          <Row label="Ingreso">{new Date(caso.fecha_ingreso + "T00:00:00").toLocaleDateString("es-AR")}</Row>
          <Row label="Cierre" last>
            {editing ? (
              <input type="date" className="mv-input" value={form.fecha_cierre} onChange={(e) => update("fecha_cierre", e.target.value)} />
            ) : caso.fecha_cierre ? (
              new Date(caso.fecha_cierre + "T00:00:00").toLocaleDateString("es-AR")
            ) : (
              "—"
            )}
          </Row>
        </MobileSection>

        <MobileSection title="Asegurado / titular">
          <Row label="Nombre y apellido">
            {editing ? (
              <input className="mv-input" value={form.asegurado_nombre} onChange={(e) => update("asegurado_nombre", e.target.value)} />
            ) : (
              caso.asegurado?.nombre || "—"
            )}
          </Row>
          <Row label="DNI">
            {editing ? (
              <input className="mv-input" value={form.asegurado_dni} onChange={(e) => update("asegurado_dni", e.target.value)} />
            ) : (
              caso.asegurado?.dni || "—"
            )}
          </Row>
          <Row label="Teléfono">
            {editing ? (
              <input className="mv-input" value={form.asegurado_telefono} onChange={(e) => update("asegurado_telefono", e.target.value)} />
            ) : (
              caso.asegurado?.telefono || "—"
            )}
          </Row>
          <Row label="Email">
            {editing ? (
              <input type="email" className="mv-input" value={form.asegurado_email} onChange={(e) => update("asegurado_email", e.target.value)} />
            ) : (
              caso.asegurado?.email || "—"
            )}
          </Row>
          <Row label="Dirección">
            {editing ? (
              <input className="mv-input" value={form.asegurado_direccion} onChange={(e) => update("asegurado_direccion", e.target.value)} />
            ) : (
              caso.asegurado?.direccion || "—"
            )}
          </Row>
          <Row label="Entre calles">
            {editing ? (
              <input
                className="mv-input"
                value={form.asegurado_entre_calles}
                onChange={(e) => update("asegurado_entre_calles", e.target.value)}
              />
            ) : (
              caso.asegurado?.entre_calles || "—"
            )}
          </Row>
          <Row label="Localidad">
            {editing ? (
              <input
                className="mv-input"
                value={form.asegurado_localidad}
                onChange={(e) => update("asegurado_localidad", e.target.value)}
              />
            ) : (
              caso.asegurado?.localidad || "—"
            )}
          </Row>
          <Row label="Partido">
            {editing ? (
              <input className="mv-input" value={form.asegurado_partido} onChange={(e) => update("asegurado_partido", e.target.value)} />
            ) : (
              caso.asegurado?.partido || "—"
            )}
          </Row>
          <Row label="Provincia" last>
            {editing ? (
              <input
                className="mv-input"
                value={form.asegurado_provincia}
                onChange={(e) => update("asegurado_provincia", e.target.value)}
              />
            ) : (
              caso.asegurado?.provincia || "—"
            )}
          </Row>
        </MobileSection>

        <MobileSection title="Vehículo">
          <Row label="Dominio">
            {editing ? (
              <input className="mv-input uppercase" value={form.vehiculo_dominio} onChange={(e) => update("vehiculo_dominio", e.target.value)} />
            ) : (
              caso.vehiculo?.dominio || "—"
            )}
          </Row>
          <Row label="Marca / modelo">
            {editing ? (
              <div className="flex gap-2">
                <input className="mv-input" value={form.vehiculo_marca} onChange={(e) => update("vehiculo_marca", e.target.value)} />
                <input className="mv-input" value={form.vehiculo_modelo} onChange={(e) => update("vehiculo_modelo", e.target.value)} />
              </div>
            ) : (
              [caso.vehiculo?.marca, caso.vehiculo?.modelo].filter(Boolean).join(" ") || "—"
            )}
          </Row>
          <Row label="Año">
            {editing ? (
              <input
                type="number"
                className="mv-input"
                value={form.vehiculo_anio}
                onChange={(e) => update("vehiculo_anio", e.target.value)}
              />
            ) : (
              caso.vehiculo?.anio || "—"
            )}
          </Row>
          <Row label="Desarmadero" last>
            {caso.desarmadero?.nombre ?? "—"}
          </Row>
        </MobileSection>

        <MobileSection title="Gestor de campo">
          <Row label="Gestor asignado" last={!(!soloLectura && !editing && caso.gestor_id)}>
            {editing ? (
              <select className="mv-input" value={form.gestor_id} onChange={(e) => update("gestor_id", e.target.value)}>
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
          </Row>

          {!soloLectura && !editing && caso.gestor_id && (
            <div className="pt-3 pb-1 text-sm space-y-2">
              <div style={{ color: "var(--mv-neutral-700)" }}>
                Enlace para que {caso.gestor?.nombre} vea los datos del caso, sin necesitar cuenta:
              </div>
              <div className="text-xs break-all" style={{ fontFamily: "ui-monospace, monospace", color: "var(--mv-neutral-800)" }}>
                {enlaceGestor || "Generando..."}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" className="mv-btn mv-btn-secondary text-xs px-3 py-1.5" onClick={copiarMensajeGestor}>
                  {copiado ? "¡Copiado!" : "Copiar mensaje"}
                </button>
                <button
                  type="button"
                  className="mv-btn mv-btn-secondary text-xs px-3 py-1.5"
                  disabled={regenerando}
                  onClick={regenerarEnlaceGestor}
                >
                  {regenerando ? "Regenerando..." : "Regenerar enlace"}
                </button>
              </div>
            </div>
          )}

          {notificarGestor && (
            <div className="pt-3">
              <SelectorNotificacion
                casoId={caso.id}
                caso={notificarGestor}
                tipo="gestor_asignado"
                onClose={() => setNotificarGestor(null)}
              />
            </div>
          )}
        </MobileSection>

        <MobileSection title="Datos económicos">
          <Row label="Suma asegurada">
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="mv-input"
                value={form.suma_asegurada}
                onChange={(e) => update("suma_asegurada", Number(e.target.value))}
              />
            ) : (
              formatCurrency(caso.suma_asegurada)
            )}
          </Row>
          <Row label="Valor InfoAuto">
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="mv-input"
                value={form.valor_infoauto}
                onChange={(e) => update("valor_infoauto", Number(e.target.value))}
              />
            ) : (
              formatCurrency(caso.valor_infoauto)
            )}
          </Row>
          <Row label="Deuda patentes">
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="mv-input"
                value={form.deuda_patentes}
                onChange={(e) => update("deuda_patentes", Number(e.target.value))}
              />
            ) : (
              formatCurrency(caso.deuda_patentes)
            )}
          </Row>
          <Row label="Deuda multas" last>
            {editing ? (
              <input
                type="number"
                step="0.01"
                className="mv-input"
                value={form.deuda_multas}
                onChange={(e) => update("deuda_multas", Number(e.target.value))}
              />
            ) : (
              formatCurrency(caso.deuda_multas)
            )}
          </Row>
        </MobileSection>

        {!editing && (
          <div className="flex gap-2.5">
            <a href={`tel:${caso.asegurado?.telefono ?? ""}`} className="mv-btn mv-btn-primary flex-1 py-3">
              Llamar al asegurado
            </a>
            <a
              href={`/api/casos/${caso.id}/autorizacion-retiro?formato=pdf`}
              className="mv-btn mv-btn-secondary flex-1 py-3"
            >
              Autorización .pdf
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mv-card px-3.5">
      <h3 className="mv-heading text-[15px] pt-3.5 pb-1">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
  last
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3.5 py-2.5"
      style={{ borderBottom: last ? "none" : "1px solid var(--mv-divider)" }}
    >
      <span className="mv-label shrink-0 pt-0.5">{label}</span>
      <span
        className="text-[13.5px] text-right flex-1 min-w-0"
        style={{ color: "var(--mv-text)", overflowWrap: "anywhere", wordBreak: "break-word" }}
      >
        {children}
      </span>
    </div>
  );
}
