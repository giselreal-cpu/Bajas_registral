import Link from "next/link";
import { ESTADOS } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";
import { obtenerDatosPanel, nombreMes, PanelFiltros } from "@/lib/panelData";
import { avanceCaso } from "@/lib/avanceCaso";
import AvanceBar from "@/components/AvanceBar";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default async function PanelPage({ searchParams }: { searchParams: PanelFiltros }) {
  const datos = await obtenerDatosPanel(searchParams);
  const usuarioActual = await getUsuarioActual();
  const puedeVerTiempos = usuarioActual?.rol !== "compania";
  const puedeVerFinanzas = usuarioActual?.rol !== "compania";

  const {
    errores,
    aseguradoras,
    tiposBaja,
    hayFiltrosPanel,
    totalCasos,
    casosAbiertos,
    casosCerrados,
    conteoPorEstado,
    maxConteo,
    casosSinMovimiento,
    casosSinContactar,
    rankingGestores,
    casosConTiempos,
    promedioTramite,
    casosConPresentacion,
    promedioPresentacionCierre,
    eventosPorTipo,
    encuestasEnviadas,
    encuestasRespondidas,
    encuestasSinResponder,
    promedioContacto,
    promedioTraslado,
    promedioGestoria,
    facturasPendientes,
    totalIngresosPanel,
    totalEgresosPanel,
    gananciaNetaPanel,
    resumenMensual,
    itemsAtencionLimitados,
    totalACobrarCartera,
    casosACobrarCartera,
    totalPendienteAprobar,
    cantidadPendienteAprobar,
    margenMesActual
  } = datos;

  const primerNombre = usuarioActual?.nombre?.split(" ")[0] ?? "";
  const horaActual = new Date().getHours();
  const saludo = horaActual < 12 ? "Buen día" : horaActual < 20 ? "Buenas tardes" : "Buenas noches";

  // "Los casos que piden atención" del mockup = misma señal que antes se
  // mostraba en dos cajas separadas (sin movimiento / sin contactar),
  // unificada en una sola lista.
  const casosQuePidenAtencion = [
    ...casosSinMovimiento.map((c) => ({
      id: c.id,
      numero_siniestro: c.numero_siniestro,
      asegurado: c.asegurado,
      responsable: c.responsable,
      motivo: `${c.dias} días sin movimiento`,
      clase: "bg-amber-100 text-amber-800"
    })),
    ...casosSinContactar.map((c) => ({
      id: c.id,
      numero_siniestro: c.numero_siniestro,
      asegurado: c.asegurado,
      responsable: c.responsable,
      motivo: "Sin contactar al asegurado",
      clase: "bg-sky-100 text-sky-800"
    }))
  ].slice(0, 10);

  const hoyPanel = new Date();
  hoyPanel.setHours(0, 0, 0, 0);
  const en7Dias = new Date(hoyPanel);
  en7Dias.setDate(en7Dias.getDate() + 7);
  const vencimientosSemana = itemsAtencionLimitados.filter((item) => {
    if (!item.badgeTexto) return false;
    const [dia, mes, anio] = item.badgeTexto.split("/");
    if (!dia || !mes || !anio) return false;
    const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
    return fecha <= en7Dias;
  });

  // Mismos filtros del Panel, para que "Ver detalle →" lleve a
  // /panel/detalle mostrando el mismo recorte de casos.
  const queryFiltros = new URLSearchParams();
  if (searchParams.aseguradora_id) queryFiltros.set("aseguradora_id", searchParams.aseguradora_id);
  if (searchParams.mes) queryFiltros.set("mes", searchParams.mes);
  if (searchParams.tipo_baja_id) queryFiltros.set("tipo_baja_id", searchParams.tipo_baja_id);
  const qs = queryFiltros.toString();
  const hrefDetalle = (ancla: string) => `/panel/detalle${qs ? `?${qs}` : ""}#${ancla}`;

  const totalEventosSinCompletar = Array.from(eventosPorTipo.values()).reduce(
    (acc, l) => acc + l.length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-brand-900">
            {saludo}{primerNombre ? `, ${primerNombre}` : ""}
          </h1>
          <p className="text-sm text-slate-500">
            Estado general de los casos y próximos vencimientos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/exportar" className="btn-secondary">
            Exportar
          </Link>
          <Link href="/casos/nuevo" className="btn-primary">
            + Nuevo caso
          </Link>
        </div>
      </div>

      <form className="card p-4 flex flex-wrap gap-3 items-end" method="get">
        <div className="flex-1 min-w-[160px]">
          <label className="label">Compañía</label>
          <select
            name="aseguradora_id"
            defaultValue={searchParams.aseguradora_id ?? ""}
            className="input"
          >
            <option value="">Todas</option>
            {aseguradoras?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Mes de ingreso</label>
          <input
            type="month"
            name="mes"
            defaultValue={searchParams.mes ?? ""}
            className="input"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Tipo de baja</label>
          <select
            name="tipo_baja_id"
            defaultValue={searchParams.tipo_baja_id ?? ""}
            className="input"
          >
            <option value="">Todos</option>
            {tiposBaja?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
        {hayFiltrosPanel && (
          <Link href="/panel" className="btn-secondary">
            Quitar filtros
          </Link>
        )}
      </form>

      {(errores.errorCasos ||
        errores.errorVenc ||
        errores.errorMov ||
        errores.errorCerrados ||
        errores.errorPresentacion ||
        errores.errorContactos) && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">
          {errores.errorCasos?.message ||
            errores.errorVenc?.message ||
            errores.errorMov?.message ||
            errores.errorCerrados?.message ||
            errores.errorPresentacion?.message ||
            errores.errorContactos?.message}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Casos abiertos" value={casosAbiertos} />
        <StatCard label="Sin movimiento 7+ días" value={casosSinMovimiento.length} />
        {puedeVerFinanzas && (
          <StatCard label="A cobrar" value={formatCurrency(totalACobrarCartera)} sub={`${casosACobrarCartera} ${casosACobrarCartera === 1 ? "caso" : "casos"}`} />
        )}
        {puedeVerFinanzas && (
          <StatCard label="A rendir" value={formatCurrency(totalPendienteAprobar)} sub={`${cantidadPendienteAprobar} ${cantidadPendienteAprobar === 1 ? "gasto" : "gastos"}`} />
        )}
        {puedeVerFinanzas && (
          <StatCard label="Margen del mes" value={margenMesActual !== null ? `${margenMesActual}%` : "—"} />
        )}
      </div>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-slate-800">Los casos que piden atención</h2>
          <span className="text-xs text-slate-400">{casosQuePidenAtencion.length}</span>
        </div>
        {casosQuePidenAtencion.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {casosQuePidenAtencion.map((c) => (
              <div key={`${c.id}-${c.motivo}`} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/casos/${c.id}`}
                    className="text-brand-700 font-medium hover:underline text-sm"
                  >
                    {c.numero_siniestro}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {c.asegurado?.nombre} · {c.responsable?.nombre ?? "Sin responsable"}
                  </p>
                </div>
                <span className={`badge shrink-0 ${c.clase}`}>{c.motivo}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hay casos que pidan atención por ahora.</p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Avance de la cartera por etapa</h2>
          <div className="space-y-3">
            {ESTADOS.map((e) => {
              const cantidad = conteoPorEstado[e.value] ?? 0;
              const pct = Math.round((cantidad / maxConteo) * 100);
              return (
                <Link
                  key={e.value}
                  href={`/casos?estado=${e.value}${
                    searchParams.aseguradora_id
                      ? `&aseguradora_id=${searchParams.aseguradora_id}`
                      : ""
                  }`}
                  className="block group"
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 group-hover:text-brand-600">
                      {e.label}
                    </span>
                    <span className="text-slate-500">{cantidad}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-silver-200 overflow-hidden">
                    <div
                      className="h-full bg-accent-600 rounded-full"
                      style={{ width: `${cantidad === 0 ? 0 : Math.max(pct, 4)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-slate-800">Vencimientos de esta semana</h2>
            <Link href="/agenda" className="text-sm text-brand-600 hover:underline">
              Ver agenda completa
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {vencimientosSemana.map((item) => (
              <div key={item.key} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/casos/${item.casoId}`}
                    className="text-brand-600 font-medium hover:underline text-sm"
                  >
                    {item.numero}
                  </Link>
                  <p className="text-sm text-slate-700 truncate">{item.detalle}</p>
                  <p className="text-xs text-slate-400">{item.meta}</p>
                </div>
                {item.badgeTexto && (
                  <span className={`badge shrink-0 ${item.badgeClase}`}>{item.badgeTexto}</span>
                )}
              </div>
            ))}
            {vencimientosSemana.length === 0 && (
              <p className="text-sm text-slate-500 py-2">No hay vencimientos en los próximos 7 días.</p>
            )}
          </div>
        </section>
      </div>

      {puedeVerFinanzas && cantidadPendienteAprobar > 0 && (
        <section className="card border-accent-200 bg-accent-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-heading font-semibold text-accent-900">Pendiente de aprobar</h2>
              <p className="text-sm text-accent-800 mt-0.5">
                {cantidadPendienteAprobar} {cantidadPendienteAprobar === 1 ? "gasto" : "gastos"} de campo
                por {formatCurrency(totalPendienteAprobar)} esperando aprobación.
              </p>
            </div>
            <Link href="/administracion" className="btn-secondary shrink-0">
              Ir a Administración →
            </Link>
          </div>
        </section>
      )}

      {puedeVerTiempos && rankingGestores.length > 0 && (
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-800">Casos por gestor</h2>
            <Link href={hrefDetalle("gestores")} className="text-sm text-brand-600 hover:underline">
              Ver detalle →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-4 font-medium">Gestor</th>
                  <th className="py-1 pr-4 font-medium">Casos asignados</th>
                  <th className="py-1 pr-4 font-medium">Pendientes*</th>
                  <th className="py-1 pr-4 font-medium">Cerrados sin pagar**</th>
                </tr>
              </thead>
              <tbody>
                {rankingGestores.map((g) => (
                  <tr key={g.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-4">{g.nombre}</td>
                    <td className="py-1.5 pr-4">{g.total}</td>
                    <td className="py-1.5 pr-4">{g.pendientes.length}</td>
                    <td className="py-1.5 pr-4">
                      {g.cerradosSinPagar.length > 0 ? (
                        <span className="badge bg-amber-100 text-amber-800">
                          {g.cerradosSinPagar.length}
                        </span>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            *No están en &quot;Documentación enviada a la Cía&quot; ni cerrados. **Casos cerrados
            sin un movimiento de &quot;Honorarios por Gestoría&quot; marcado como pagado.
          </p>
        </section>
      )}

      {puedeVerTiempos && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-1">Rentabilidad (casos cerrados)</h2>
          <p className="text-xs text-slate-400 mb-3">
            Ingresos = plata efectivamente cobrada, no lo facturado pendiente. Egresos = solo lo
            efectivamente pagado, no lo cargado pendiente de pago.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="rounded-md bg-emerald-50 border border-emerald-100 p-3">
              <div className="text-xs text-emerald-700">Ingresos</div>
              <div className="text-lg font-semibold text-emerald-800">
                {formatCurrency(totalIngresosPanel)}
              </div>
            </div>
            <div className="rounded-md bg-red-50 border border-red-100 p-3">
              <div className="text-xs text-red-700">Egresos</div>
              <div className="text-lg font-semibold text-red-800">
                {formatCurrency(totalEgresosPanel)}
              </div>
            </div>
            <div
              className={`rounded-md border p-3 ${
                gananciaNetaPanel >= 0
                  ? "bg-accent-50 border-accent-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="text-xs text-slate-600">Ganancia neta</div>
              <div
                className={`text-lg font-semibold ${
                  gananciaNetaPanel >= 0 ? "text-accent-700" : "text-red-800"
                }`}
              >
                {formatCurrency(gananciaNetaPanel)}
              </div>
            </div>
          </div>

          <h3 className="text-sm font-medium text-slate-700 mb-2">Facturas pendientes de cobro</h3>
          {facturasPendientes.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {facturasPendientes.map((f) => (
                <div key={f.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/casos/${f.caso_id}`}
                      className="text-brand-700 font-medium hover:underline text-sm"
                    >
                      N° {f.numero_factura} — {f.caso?.numero_siniestro}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {f.tipo_receptor === "compania" ? "Compañía" : "Desarmadero"} ·{" "}
                      {formatCurrency(f.monto_total)}
                    </p>
                  </div>
                  <span className="badge bg-amber-100 text-amber-800 shrink-0">
                    {f.estado === "cobrado_parcial" ? "Cobrado parcial" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay facturas pendientes de cobro.</p>
          )}
        </section>
      )}

      <section className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium text-slate-800">Eventos sin completar</h2>
          <Link href={hrefDetalle("eventos")} className="text-sm text-brand-600 hover:underline">
            Ver detalle →
          </Link>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Por cada tipo de evento, cuántos casos lo tienen cargado pero todavía no completado
          ({totalEventosSinCompletar} en total). Un mismo caso puede aparecer en más de un tipo a
          la vez.
        </p>
        <div className="space-y-1">
          {TIPOS_EVENTO.map((t) => {
            const cantidad = eventosPorTipo.get(t.label)?.length ?? 0;
            return (
              <div
                key={t.value}
                className="flex items-center justify-between text-sm px-1 py-1.5"
              >
                <span className={cantidad > 0 ? "text-slate-700" : "text-slate-400"}>
                  {t.label}
                </span>
                {cantidad > 0 ? (
                  <span className="badge bg-amber-100 text-amber-800">{cantidad}</span>
                ) : (
                  <span className="text-slate-400">0</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-800">Encuestas de satisfacción</h2>
          <Link href={hrefDetalle("encuestas")} className="text-sm text-brand-600 hover:underline">
            Ver detalle →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard label="Enviadas" value={encuestasEnviadas} />
          <StatCard label="Respondidas" value={encuestasRespondidas} />
          <StatCard label="Sin responder" value={encuestasSinResponder} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Contacto inicial (promedio)"
            value={promedioContacto ?? 0}
            sufijo="/5"
          />
          <StatCard label="Traslado (promedio)" value={promedioTraslado ?? 0} sufijo="/5" />
          <StatCard label="Gestoría (promedio)" value={promedioGestoria ?? 0} sufijo="/5" />
        </div>
      </section>

      {puedeVerTiempos && (
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-800">Tiempos de trámite (casos cerrados)</h2>
            <Link href={hrefDetalle("tiempos")} className="text-sm text-brand-600 hover:underline">
              Ver detalle →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              label="Trámite completo (promedio)"
              value={promedioTramite ?? 0}
              sufijo=" días"
            />
            <StatCard label="Casos cerrados analizados" value={casosConTiempos.length} />
            <StatCard
              label="Presentación → cierre (promedio)"
              value={promedioPresentacionCierre ?? 0}
              sufijo=" días"
            />
            <StatCard label="Casos con ese dato" value={casosConPresentacion.length} />
          </div>
        </section>
      )}

      {puedeVerTiempos && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-1">
            Ganancia neta por mes (casos cerrados)
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Ganancia neta = todo lo facturado (cobrado o no) menos todos los egresos cargados
            (pagados y pendientes de pago), sobre los autos cerrados cada mes.
          </p>
          {resumenMensual.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Mes</th>
                    <th className="py-1 pr-4 font-medium">Autos cerrados</th>
                    <th className="py-1 pr-4 font-medium">Ganancia neta</th>
                    <th className="py-1 pr-4 font-medium">Cobrado al desarmadero</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenMensual.map((r) => (
                    <tr key={r.mes} className="border-t border-slate-100">
                      <td className="py-1.5 pr-4 font-medium text-slate-800">
                        {nombreMes(r.mes)}
                      </td>
                      <td className="py-1.5 pr-4">{r.autosCerrados}</td>
                      <td
                        className={`py-1.5 pr-4 font-medium ${
                          r.gananciaNeta >= 0 ? "text-accent-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(r.gananciaNeta)}
                      </td>
                      <td className="py-1.5 pr-4">{formatCurrency(r.cobradoDesarmadero)}</td>
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

function StatCard({
  label,
  value,
  sufijo,
  sub
}: {
  label: string;
  value: number | string;
  sufijo?: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {value}
        {sufijo && <span className="text-base font-normal text-slate-500">{sufijo}</span>}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
