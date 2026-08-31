import Link from "next/link";
import { ESTADOS } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";
import { obtenerDatosPanel, PanelFiltros } from "@/lib/panelData";
import RecordatorioEncuesta from "@/components/panel/RecordatorioEncuesta";

export const dynamic = "force-dynamic";

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

export default async function PanelDetallePage({
  searchParams
}: {
  searchParams: PanelFiltros & { gestor_id?: string };
}) {
  const datos = await obtenerDatosPanel(searchParams);
  const usuarioActual = await getUsuarioActual();
  const puedeVerTiempos = usuarioActual?.rol !== "compania";

  const {
    rankingGestores,
    eventosPorTipo,
    encuestasRows,
    comentariosDestacados,
    encuestasPendientesRecordatorio,
    casosConTiempos,
    casosCerradosOrdenados
  } = datos;

  const queryFiltros = new URLSearchParams();
  if (searchParams.aseguradora_id) queryFiltros.set("aseguradora_id", searchParams.aseguradora_id);
  if (searchParams.mes) queryFiltros.set("mes", searchParams.mes);
  if (searchParams.tipo_baja_id) queryFiltros.set("tipo_baja_id", searchParams.tipo_baja_id);
  const qs = queryFiltros.toString();

  const gestorSeleccionado = rankingGestores.find((g) => g.id === searchParams.gestor_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Detalle del Panel</h1>
          <p className="text-sm text-slate-500">
            Listados completos por caso — el mismo recorte de casos que el Panel, según los
            filtros aplicados ahí.
          </p>
        </div>
        <Link href={`/panel${qs ? `?${qs}` : ""}`} className="btn-secondary">
          ← Volver al Panel
        </Link>
      </div>

      {puedeVerTiempos && (
        <section id="gestores" className="card p-4 scroll-mt-4">
          <h2 className="font-medium text-slate-800 mb-3">Casos por gestor — detalle</h2>
          <form className="flex flex-wrap items-end gap-3 mb-4" method="get">
            {searchParams.aseguradora_id && (
              <input type="hidden" name="aseguradora_id" value={searchParams.aseguradora_id} />
            )}
            {searchParams.mes && <input type="hidden" name="mes" value={searchParams.mes} />}
            {searchParams.tipo_baja_id && (
              <input type="hidden" name="tipo_baja_id" value={searchParams.tipo_baja_id} />
            )}
            <div className="flex-1 min-w-[220px]">
              <label className="label">Ver detalle de</label>
              <select
                name="gestor_id"
                defaultValue={searchParams.gestor_id ?? ""}
                className="input"
              >
                <option value="">Elegí un gestor...</option>
                {rankingGestores.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre} ({g.pendientes.length} pendientes, {g.cerradosSinPagar.length} sin
                    pagar)
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-secondary" type="submit">
              Ver
            </button>
          </form>

          {gestorSeleccionado ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">
                  Pendientes de {gestorSeleccionado.nombre} ({gestorSeleccionado.pendientes.length})
                </h3>
                {gestorSeleccionado.pendientes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No tiene casos pendientes — todos llegaron a &quot;Documentación enviada a la
                    Cía&quot; o están cerrados.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {gestorSeleccionado.pendientes.map((c) => (
                      <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/casos/${c.id}`}
                            className="text-brand-700 font-medium hover:underline text-sm"
                          >
                            {c.numero_siniestro}
                          </Link>
                          <p className="text-xs text-slate-500">{c.asegurado?.nombre}</p>
                        </div>
                        <span className={`badge shrink-0 ${estadoBadgeClass(c.estado)}`}>
                          {ESTADOS.find((e) => e.value === c.estado)?.label ?? c.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">
                  Cerrados sin pagar a {gestorSeleccionado.nombre} (
                  {gestorSeleccionado.cerradosSinPagar.length})
                </h3>
                {gestorSeleccionado.cerradosSinPagar.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No tiene casos cerrados pendientes de pago de honorarios.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {gestorSeleccionado.cerradosSinPagar.map((c) => (
                      <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/casos/${c.id}`}
                            className="text-brand-700 font-medium hover:underline text-sm"
                          >
                            {c.numero_siniestro}
                          </Link>
                          <p className="text-xs text-slate-500">{c.asegurado?.nombre}</p>
                        </div>
                        <span className="badge shrink-0 bg-amber-100 text-amber-800">
                          Sin pagar
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Elegí un gestor arriba para ver su detalle.</p>
          )}
        </section>
      )}

      <section id="eventos" className="card p-4 scroll-mt-4">
        <h2 className="font-medium text-slate-800 mb-1">Eventos sin completar — detalle</h2>
        <p className="text-xs text-slate-400 mb-3">
          Por cada tipo de evento, los casos que lo tienen cargado pero todavía no completado. Un
          mismo caso puede aparecer en más de un tipo a la vez.
        </p>
        <div className="space-y-2">
          {TIPOS_EVENTO.map((t) => {
            const lista = eventosPorTipo.get(t.label) ?? [];
            if (lista.length === 0) {
              return (
                <div
                  key={t.value}
                  className="flex items-center justify-between text-sm px-1 py-1.5 text-slate-400"
                >
                  <span>{t.label}</span>
                  <span>0</span>
                </div>
              );
            }
            return (
              <details key={t.value} className="rounded-md border border-slate-100 overflow-hidden">
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-sm hover:bg-slate-50">
                  <span className="text-slate-700">{t.label}</span>
                  <span className="badge bg-amber-100 text-amber-800">{lista.length}</span>
                </summary>
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {lista.map((ev, i) => (
                    <div
                      key={`${ev.casoId}-${i}`}
                      className="px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <Link
                        href={`/casos/${ev.casoId}`}
                        className="text-brand-600 hover:underline text-sm font-medium"
                      >
                        {ev.numeroSiniestro} · {ev.dominio}
                      </Link>
                      <span className={`badge shrink-0 ${estadoBadgeClass(ev.estado)}`}>
                        {ESTADOS.find((e) => e.value === ev.estado)?.label ?? ev.estado}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section id="encuestas" className="card p-4 scroll-mt-4">
        <h2 className="font-medium text-slate-800 mb-3">Encuestas de satisfacción — detalle</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Comentarios destacados</h3>
            {comentariosDestacados.length > 0 ? (
              <ul className="space-y-2">
                {comentariosDestacados.map((e) => (
                  <li key={e.id} className="border border-slate-100 rounded-md p-2 text-sm">
                    <Link
                      href={`/casos/${e.caso?.id}`}
                      className="text-brand-600 hover:underline font-medium"
                    >
                      {e.caso?.numero_siniestro} · {e.caso?.vehiculo?.dominio ?? "—"}
                    </Link>
                    <p className="text-slate-600 italic">&quot;{e.comentario}&quot;</p>
                    <p className="text-xs text-slate-400">
                      Contacto {e.calificacion_contacto}/5 · Traslado {e.calificacion_traslado}/5 ·
                      Gestoría {e.calificacion_gestoria}/5
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Todavía no hay comentarios cargados.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Pendientes de recordatorio (48hs hábiles sin responder)
            </h3>
            {encuestasPendientesRecordatorio.length > 0 ? (
              <ul className="space-y-2">
                {encuestasPendientesRecordatorio.map((e) => (
                  <li key={e.id} className="border border-slate-100 rounded-md p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/casos/${e.caso?.id}`}
                        className="text-brand-600 hover:underline font-medium"
                      >
                        {e.caso?.numero_siniestro} · {e.caso?.vehiculo?.dominio ?? "—"}
                      </Link>
                      <span className="badge bg-amber-100 text-amber-800 shrink-0">
                        {e.horasHabiles}hs hábiles
                      </span>
                    </div>
                    <RecordatorioEncuesta
                      encuestaId={e.id}
                      token={e.token}
                      asegurado={e.caso?.asegurado?.nombre ?? ""}
                      telefono={e.caso?.asegurado?.telefono ?? null}
                      dominio={e.caso?.vehiculo?.dominio ?? ""}
                      numeroSiniestro={e.caso?.numero_siniestro ?? ""}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No hay encuestas pendientes de recordatorio.</p>
            )}
          </div>
        </div>

        <h3 className="text-sm font-medium text-slate-700 mb-2">
          Todas las enviadas ({encuestasRows.length})
        </h3>
        {encuestasRows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {[...encuestasRows]
              .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
              .map((e) => (
                <div key={e.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/casos/${e.caso?.id}`}
                      className="text-brand-600 hover:underline text-sm font-medium"
                    >
                      {e.caso?.numero_siniestro} · {e.caso?.vehiculo?.dominio ?? "—"}
                    </Link>
                    <p className="text-xs text-slate-400">
                      Enviada el {new Date(e.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <span
                    className={`badge shrink-0 ${
                      e.respondida
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {e.respondida ? "Respondida" : "Sin responder"}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Todavía no se envió ninguna.</p>
        )}
      </section>

      {puedeVerTiempos && (
        <section id="tiempos" className="card p-4 scroll-mt-4">
          <h2 className="font-medium text-slate-800 mb-3">
            Tiempos de trámite — casos cerrados ({casosConTiempos.length})
          </h2>
          {casosCerradosOrdenados.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1 pr-4 font-medium">N° siniestro</th>
                    <th className="py-1 pr-4 font-medium">Ingreso</th>
                    <th className="py-1 pr-4 font-medium">Cierre</th>
                    <th className="py-1 pr-4 font-medium">Días trámite</th>
                    <th className="py-1 pr-4 font-medium">Días presentación → cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {casosCerradosOrdenados.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-4">
                        <Link
                          href={`/casos/${c.id}`}
                          className="text-brand-600 font-medium hover:underline"
                        >
                          {c.numero_siniestro}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-4">
                        {new Date(c.fecha_ingreso + "T00:00:00").toLocaleDateString("es-AR")}
                      </td>
                      <td className="py-1.5 pr-4">
                        {new Date(c.fecha_cierre! + "T00:00:00").toLocaleDateString("es-AR")}
                      </td>
                      <td className="py-1.5 pr-4">{c.diasTramite}</td>
                      <td className="py-1.5 pr-4">{c.diasPresentacionCierre ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Todavía no hay casos cerrados con fecha de cierre cargada.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
