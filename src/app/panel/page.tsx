import Link from "next/link";
import { ESTADOS } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";
import { obtenerDatosPanel, obtenerDatosPanelCompania, PanelFiltros } from "@/lib/panelData";
import { avanceCaso } from "@/lib/avanceCaso";
import AvanceBar from "@/components/AvanceBar";
import PanelCompania from "@/components/panel/PanelCompania";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default async function PanelPage({ searchParams }: { searchParams: PanelFiltros }) {
  const usuarioActual = await getUsuarioActual();

  if (usuarioActual?.rol === "compania") {
    const datosCompania = await obtenerDatosPanelCompania(searchParams.mes, searchParams.tramitador_id);
    return <PanelCompania datos={datosCompania} primerNombre={usuarioActual?.nombre?.split(" ")[0] ?? ""} />;
  }

  const datos = await obtenerDatosPanel(searchParams);
  // Ya se devolvió arriba para "compania" — acá siempre es operador/administrador.
  const puedeVerTiempos = true;
  const puedeVerFinanzas = true;

  const {
    errores,
    aseguradoras,
    tiposBaja,
    tramitadores,
    responsables,
    hayFiltrosPanel,
    totalCasos,
    casosAbiertos,
    casosCerrados,
    conteoPorEstado,
    maxConteo,
    casosSinMovimiento,
    casosSinContactar,
    rankingGestores,
    eventosPorTipo,
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
      vehiculo: c.vehiculo,
      asegurado: c.asegurado,
      responsable: c.responsable,
      motivo: `${c.dias} días sin movimiento`,
      clase: "bg-amber-100 text-amber-800"
    })),
    ...casosSinContactar.map((c) => ({
      id: c.id,
      vehiculo: c.vehiculo,
      asegurado: c.asegurado,
      responsable: c.responsable,
      motivo: "Sin contactar al asegurado",
      clase: "bg-sky-100 text-sky-800"
    }))
  ].slice(0, 15);

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
  if (searchParams.tramitador_id) queryFiltros.set("tramitador_id", searchParams.tramitador_id);
  if (searchParams.responsable_id) queryFiltros.set("responsable_id", searchParams.responsable_id);
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
        <div className="flex-1 min-w-[160px]">
          <label className="label">Trámitador</label>
          <select
            name="tramitador_id"
            defaultValue={searchParams.tramitador_id ?? ""}
            className="input"
          >
            <option value="">Todos</option>
            {(
              tramitadores as unknown as
                | {
                    id: string;
                    nombre: string;
                    aseguradora_id: string | null;
                    aseguradora: { nombre: string } | null;
                  }[]
                | null
            )
              ?.filter((t) => !searchParams.aseguradora_id || t.aseguradora_id === searchParams.aseguradora_id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {!searchParams.aseguradora_id && t.aseguradora ? ` — ${t.aseguradora.nombre}` : ""}
                </option>
              ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Responsable</label>
          <select
            name="responsable_id"
            defaultValue={searchParams.responsable_id ?? ""}
            className="input"
          >
            <option value="">Todos</option>
            {responsables.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
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
        errores.errorCerrados ||
        errores.errorPresentacion ||
        errores.errorContactos) && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">
          {errores.errorCasos?.message ||
            errores.errorVenc?.message ||
            errores.errorCerrados?.message ||
            errores.errorPresentacion?.message ||
            errores.errorContactos?.message}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Casos abiertos" value={casosAbiertos} sub={`${totalCasos} históricos`} />
        <StatCard label="Sin movimiento 3+ días" value={casosSinMovimiento.length} />
        {puedeVerFinanzas && (
          <StatCard label="A cobrar" value={formatCurrency(totalACobrarCartera)} sub={`${casosACobrarCartera} ${casosACobrarCartera === 1 ? "caso" : "casos"}`} />
        )}
        {puedeVerFinanzas && (
          <StatCard label="A rendir" value={formatCurrency(totalPendienteAprobar)} sub={`${cantidadPendienteAprobar} ${cantidadPendienteAprobar === 1 ? "gasto" : "gastos"}`} />
        )}
        {puedeVerFinanzas && (
          <StatCard
            label="Margen del mes"
            value={margenMesActual !== null ? `${margenMesActual}%` : "—"}
            sub="Devengado, no caja"
          />
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
                    {c.vehiculo?.dominio ?? "—"}
                    {(c.vehiculo?.marca || c.vehiculo?.modelo) && (
                      <span className="font-normal text-slate-500">
                        {" · "}
                        {[c.vehiculo?.marca, c.vehiculo?.modelo].filter(Boolean).join(" ")}
                      </span>
                    )}
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
