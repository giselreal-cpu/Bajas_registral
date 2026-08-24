import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Caso, ESTADOS, Estado } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";

export const dynamic = "force-dynamic";

interface VencimientoRow {
  id: string;
  caso_id: string;
  tipo_evento: string;
  fecha_fin: string | null;
  completado: boolean;
  caso: {
    numero_siniestro: string;
    estado: string;
    asegurado: { nombre: string } | null;
    responsable: { nombre: string } | null;
  } | null;
}

interface CasoResumen {
  id: string;
  estado: string;
  numero_siniestro: string;
  created_at: string;
  gestor_id: string | null;
  gestor: { nombre: string } | null;
  asegurado: { nombre: string } | null;
  responsable: { nombre: string } | null;
}

const DIAS_SIN_MOVIMIENTO = 7;

function formatCurrency(value: number): string {
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

export default async function PanelPage({
  searchParams
}: {
  searchParams: {
    aseguradora_id?: string;
    mes?: string;
    tipo_baja_id?: string;
    gestor_id?: string;
  };
}) {
  const supabase = createClient();

  let casosQuery = supabase
    .from("casos")
    .select(
      "id, estado, numero_siniestro, created_at, fecha_ingreso, aseguradora_id, tipo_baja_id, gestor_id, gestor:gestores(nombre), asegurado:asegurados(nombre), responsable:usuarios(nombre)"
    );

  if (searchParams.aseguradora_id) {
    casosQuery = casosQuery.eq("aseguradora_id", searchParams.aseguradora_id);
  }
  if (searchParams.tipo_baja_id) {
    casosQuery = casosQuery.eq("tipo_baja_id", searchParams.tipo_baja_id);
  }
  if (searchParams.mes) {
    const [anio, mes] = searchParams.mes.split("-").map(Number);
    const desde = `${searchParams.mes}-01`;
    const hastaDate = new Date(anio, mes, 1); // primer día del mes siguiente
    const hasta = hastaDate.toISOString().slice(0, 10);
    casosQuery = casosQuery.gte("fecha_ingreso", desde).lt("fecha_ingreso", hasta);
  }

  let casosCerradosQuery = supabase
    .from("casos")
    .select("id, numero_siniestro, fecha_ingreso, fecha_cierre")
    .eq("estado", "cerrado")
    .not("fecha_cierre", "is", null);

  if (searchParams.aseguradora_id) {
    casosCerradosQuery = casosCerradosQuery.eq("aseguradora_id", searchParams.aseguradora_id);
  }
  if (searchParams.tipo_baja_id) {
    casosCerradosQuery = casosCerradosQuery.eq("tipo_baja_id", searchParams.tipo_baja_id);
  }
  if (searchParams.mes) {
    const [anio, mes] = searchParams.mes.split("-").map(Number);
    const desde = `${searchParams.mes}-01`;
    const hastaDate = new Date(anio, mes, 1);
    const hasta = hastaDate.toISOString().slice(0, 10);
    casosCerradosQuery = casosCerradosQuery.gte("fecha_ingreso", desde).lt("fecha_ingreso", hasta);
  }

  const [
    { data: casos, error: errorCasos },
    { data: vencimientos, error: errorVenc },
    { data: movimientos, error: errorMov },
    { data: casosCerradosConFechas, error: errorCerrados },
    { data: eventosPresentacion, error: errorPresentacion },
    { data: contactosExistentes },
    { data: aseguradoras },
    { data: tiposBaja }
  ] = await Promise.all([
    casosQuery,
    supabase
      .from("bitacora")
      .select(
        `
        id, caso_id, tipo_evento, fecha_fin, completado,
        caso:casos(numero_siniestro, estado, asegurado:asegurados(nombre), responsable:usuarios(nombre))
      `
      )
      .eq("completado", false)
      .not("fecha_fin", "is", null)
      .order("fecha_fin", { ascending: true })
      .limit(8),
    supabase.from("bitacora").select("caso_id, created_at"),
    casosCerradosQuery,
    supabase
      .from("bitacora")
      .select("caso_id, fecha_inicio, fecha_fin")
      .eq("tipo_evento", "Presentación de Baja")
      .eq("completado", true),
    supabase.from("bitacora").select("caso_id").eq("tipo_evento", "Contacto con el asegurado"),
    supabase.from("aseguradoras").select("id, nombre").order("nombre"),
    supabase.from("tipos_baja").select("id, nombre").order("nombre")
  ]);

  const hayFiltrosPanel = !!(
    searchParams.aseguradora_id ||
    searchParams.mes ||
    searchParams.tipo_baja_id
  );

  const usuarioActual = await getUsuarioActual();
  const puedeVerTiempos = usuarioActual?.rol !== "compania";

  const totalCasos = casos?.length ?? 0;
  const casosAbiertos = casos?.filter((c) => c.estado !== "cerrado").length ?? 0;
  const casosCerrados = totalCasos - casosAbiertos;

  const conteoPorEstado: Record<string, number> = {};
  for (const e of ESTADOS) conteoPorEstado[e.value] = 0;
  for (const c of (casos as Pick<Caso, "id" | "estado">[] | null) ?? []) {
    conteoPorEstado[c.estado] = (conteoPorEstado[c.estado] ?? 0) + 1;
  }
  const maxConteo = Math.max(1, ...Object.values(conteoPorEstado));

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Último movimiento (evento de bitácora más reciente) por caso. Si un
  // caso no tiene ningún evento todavía, usamos su fecha de creación.
  const ultimoMovimientoPorCaso = new Map<string, string>();
  for (const m of movimientos ?? []) {
    const actual = ultimoMovimientoPorCaso.get(m.caso_id);
    if (!actual || m.created_at > actual) {
      ultimoMovimientoPorCaso.set(m.caso_id, m.created_at);
    }
  }

  const casosSinMovimiento = ((casos as CasoResumen[] | null) ?? [])
    .filter((c) => c.estado !== "cerrado")
    .map((c) => {
      const ultimoMovimiento = ultimoMovimientoPorCaso.get(c.id) ?? c.created_at;
      const dias = Math.floor(
        (hoy.getTime() - new Date(ultimoMovimiento).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...c, dias };
    })
    .filter((c) => c.dias >= DIAS_SIN_MOVIMIENTO)
    .sort((a, b) => b.dias - a.dias);

  // Casos abiertos que todavía no tienen ningún evento "Contacto con el
  // asegurado" cargado (ni pendiente ni completado) — para recordar que
  // hay que contactarlo.
  const casosConContactoIniciado = new Set((contactosExistentes ?? []).map((c) => c.caso_id));
  const casosSinContactar = ((casos as CasoResumen[] | null) ?? []).filter(
    (c) => c.estado !== "cerrado" && !casosConContactoIniciado.has(c.id)
  );

  // Ranking de casos por gestor de campo: total asignados vs. pendientes
  // (todavía no llegaron a "Documentación enviada a la Cía", y no están
  // cerrados) vs. cerrados sin pagar al gestor (ver más abajo, una vez
  // que se conocen los movimientos de "Honorarios por Gestoría"). Se
  // calcula sobre los mismos casos ya filtrados arriba.
  const casosPorGestorMap = new Map<
    string,
    { nombre: string; total: number; pendientes: CasoResumen[]; cerrados: CasoResumen[] }
  >();
  for (const c of (casos as CasoResumen[] | null) ?? []) {
    if (!c.gestor_id || !c.gestor) continue;
    if (!casosPorGestorMap.has(c.gestor_id)) {
      casosPorGestorMap.set(c.gestor_id, {
        nombre: c.gestor.nombre,
        total: 0,
        pendientes: [],
        cerrados: []
      });
    }
    const entrada = casosPorGestorMap.get(c.gestor_id)!;
    entrada.total++;
    if (c.estado !== "documentacion_enviada" && c.estado !== "cerrado") {
      entrada.pendientes.push(c);
    }
    if (c.estado === "cerrado") {
      entrada.cerrados.push(c);
    }
  }

  // Días entre dos fechas (ISO date, sin horas).
  function diasEntre(desde: string, hasta: string) {
    return Math.round(
      (new Date(hasta).getTime() - new Date(desde).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Última "Presentación de Baja" completada por caso (por si hubiera más
  // de una cargada, tomamos la más tardía).
  const presentacionPorCaso = new Map<string, string>();
  for (const ev of eventosPresentacion ?? []) {
    const fecha = ev.fecha_fin ?? ev.fecha_inicio;
    const actual = presentacionPorCaso.get(ev.caso_id);
    if (!actual || fecha > actual) presentacionPorCaso.set(ev.caso_id, fecha);
  }

  const casosConTiempos = (casosCerradosConFechas ?? []).map((c) => {
    const diasTramite = diasEntre(c.fecha_ingreso, c.fecha_cierre!);
    const fechaPresentacion = presentacionPorCaso.get(c.id);
    const diasPresentacionCierre = fechaPresentacion
      ? diasEntre(fechaPresentacion, c.fecha_cierre!)
      : null;
    return { ...c, diasTramite, diasPresentacionCierre };
  });

  const promedio = (valores: number[]) =>
    valores.length === 0
      ? null
      : Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;

  const promedioTramite = promedio(casosConTiempos.map((c) => c.diasTramite));
  const casosConPresentacion = casosConTiempos.filter(
    (c) => c.diasPresentacionCierre !== null
  );
  const promedioPresentacionCierre = promedio(
    casosConPresentacion.map((c) => c.diasPresentacionCierre as number)
  );

  const casosCerradosRecientes = [...casosConTiempos]
    .sort((a, b) => (b.fecha_cierre! > a.fecha_cierre! ? 1 : -1))
    .slice(0, 8);

  // Rentabilidad: ingresos/egresos/ganancia neta únicamente sobre casos
  // CERRADOS (no tiene sentido contar plata de casos todavía abiertos).
  // Ingresos = cash real (cobros + notas de crédito, no lo facturado
  // pendiente). Egresos = solo lo efectivamente pagado
  // (movimientos_caso.pagado = true), no lo cargado/pendiente de pago.
  const casoIds = (casos ?? []).map((c) => c.id);
  const casoIdsCerrados = casosConTiempos.map((c) => c.id);
  // Casos cerrados con gestor asignado (usa directamente `estado ===
  // "cerrado"`, no `casoIdsCerrados`, porque ese último requiere
  // `fecha_cierre` cargada — acá no queremos perder ningún caso cerrado
  // por eso).
  const casoIdsCerradosConGestor = Array.from(casosPorGestorMap.values()).flatMap((v) =>
    v.cerrados.map((c) => c.id)
  );
  const [
    { data: facturasCerrados },
    { data: movimientosCerrados },
    { data: facturasPendientes },
    { data: eventosSinCompletar },
    { data: honorariosGestoria }
  ] = await Promise.all([
      casoIdsCerrados.length > 0
        ? supabase
            .from("facturas")
            .select("caso_id, tipo_receptor, cobros(monto), notas_credito(monto)")
            .in("caso_id", casoIdsCerrados)
        : Promise.resolve({ data: [] as any[] }),
      casoIdsCerrados.length > 0
        ? supabase
            .from("movimientos_caso")
            .select("caso_id, monto, pagado, concepto:conceptos_movimiento(tipo)")
            .in("caso_id", casoIdsCerrados)
        : Promise.resolve({ data: [] as any[] }),
      casoIds.length > 0
        ? supabase
            .from("facturas")
            .select(
              "id, numero_factura, caso_id, tipo_receptor, monto_total, estado, caso:casos(numero_siniestro)"
            )
            .in("caso_id", casoIds)
            .neq("estado", "cobrado_total")
            .order("fecha_emision", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] as any[] }),
      casoIds.length > 0
        ? supabase
            .from("bitacora")
            .select(
              "tipo_evento, caso_id, caso:casos(numero_siniestro, estado, vehiculo:vehiculos(dominio))"
            )
            .eq("completado", false)
            .in("caso_id", casoIds)
        : Promise.resolve({ data: [] as any[] }),
      casoIdsCerradosConGestor.length > 0
        ? supabase
            .from("movimientos_caso")
            .select("caso_id, pagado, concepto:conceptos_movimiento(nombre)")
            .in("caso_id", casoIdsCerradosConGestor)
        : Promise.resolve({ data: [] as any[] })
    ]);

  // Casos cerrados (con gestor asignado) que ya tienen un movimiento de
  // "Honorarios por Gestoría" marcado como pagado — el resto de los
  // cerrados de ese gestor todavía no se le pagaron (no importa si ni
  // siquiera se cargó el movimiento, o si se cargó pero sigue pendiente).
  const casosGestoriaPagada = new Set<string>();
  for (const m of (honorariosGestoria ?? []) as unknown as {
    caso_id: string;
    pagado: boolean;
    concepto: { nombre: string } | null;
  }[]) {
    if (m.concepto?.nombre === "Honorarios por Gestoría" && m.pagado) {
      casosGestoriaPagada.add(m.caso_id);
    }
  }

  const rankingGestores = Array.from(casosPorGestorMap.entries())
    .map(([id, v]) => ({
      id,
      ...v,
      cerradosSinPagar: v.cerrados.filter((c) => !casosGestoriaPagada.has(c.id)).length
    }))
    .sort((a, b) => b.pendientes.length - a.pendientes.length);
  const gestorSeleccionado = rankingGestores.find((g) => g.id === searchParams.gestor_id);

  // Eventos de bitácora cargados pero sin completar, agrupados por tipo
  // — un mismo caso puede aparecer en varias categorías a la vez (ej.:
  // "Petición de Informes" sin completar Y "Autorización de traslado"
  // sin completar). Se arrancan todos los tipos en 0 para ver el
  // panorama completo, incluso los que no tienen ningún pendiente.
  interface EventoIncompletoRow {
    casoId: string;
    numeroSiniestro: string;
    dominio: string;
    estado: string;
  }
  const eventosPorTipo = new Map<string, EventoIncompletoRow[]>();
  for (const t of TIPOS_EVENTO) eventosPorTipo.set(t.label, []);
  for (const ev of (eventosSinCompletar ?? []) as unknown as {
    tipo_evento: string;
    caso_id: string;
    caso: { numero_siniestro: string; estado: string; vehiculo: { dominio: string } | null } | null;
  }[]) {
    const lista = eventosPorTipo.get(ev.tipo_evento) ?? [];
    lista.push({
      casoId: ev.caso_id,
      numeroSiniestro: ev.caso?.numero_siniestro ?? "—",
      dominio: ev.caso?.vehiculo?.dominio ?? "—",
      estado: ev.caso?.estado ?? ""
    });
    eventosPorTipo.set(ev.tipo_evento, lista);
  }

  const ingresosPorCaso = new Map<string, number>();
  const cobradoDesarmaderoPorCaso = new Map<string, number>();
  for (const f of (facturasCerrados ?? []) as unknown as {
    caso_id: string;
    tipo_receptor: string;
    cobros: { monto: number }[];
    notas_credito: { monto: number }[];
  }[]) {
    const cobrado =
      (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
      (f.notas_credito ?? []).reduce((acc, n) => acc + Number(n.monto), 0);
    ingresosPorCaso.set(f.caso_id, (ingresosPorCaso.get(f.caso_id) ?? 0) + cobrado);
    if (f.tipo_receptor === "desarmadero") {
      cobradoDesarmaderoPorCaso.set(
        f.caso_id,
        (cobradoDesarmaderoPorCaso.get(f.caso_id) ?? 0) + cobrado
      );
    }
  }
  const egresosPorCaso = new Map<string, number>();
  for (const m of (movimientosCerrados ?? []) as unknown as {
    caso_id: string;
    monto: number;
    pagado: boolean;
    concepto: { tipo: string } | null;
  }[]) {
    if (m.concepto?.tipo === "egreso" && m.pagado) {
      egresosPorCaso.set(m.caso_id, (egresosPorCaso.get(m.caso_id) ?? 0) + Number(m.monto));
    }
  }

  const totalIngresosPanel = Array.from(ingresosPorCaso.values()).reduce((a, b) => a + b, 0);
  const totalEgresosPanel = Array.from(egresosPorCaso.values()).reduce((a, b) => a + b, 0);
  const gananciaNetaPanel = totalIngresosPanel - totalEgresosPanel;

  interface ResumenMes {
    mes: string;
    autosCerrados: number;
    gananciaNeta: number;
    cobradoDesarmadero: number;
  }
  const resumenPorMes = new Map<string, ResumenMes>();
  for (const c of casosConTiempos) {
    const mesKey = c.fecha_cierre!.slice(0, 7);
    if (!resumenPorMes.has(mesKey)) {
      resumenPorMes.set(mesKey, { mes: mesKey, autosCerrados: 0, gananciaNeta: 0, cobradoDesarmadero: 0 });
    }
    const entrada = resumenPorMes.get(mesKey)!;
    entrada.autosCerrados += 1;
    entrada.gananciaNeta += (ingresosPorCaso.get(c.id) ?? 0) - (egresosPorCaso.get(c.id) ?? 0);
    entrada.cobradoDesarmadero += cobradoDesarmaderoPorCaso.get(c.id) ?? 0;
  }
  const resumenMensual = Array.from(resumenPorMes.values()).sort((a, b) => b.mes.localeCompare(a.mes));

  const nombreMes = (mesKey: string) => {
    const [anio, mes] = mesKey.split("-").map(Number);
    const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric"
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  };

  // Lista combinada para "Próximos vencimientos": eventos con fecha_fin
  // pendiente (vencimientos "de verdad") + casos sin movimiento hace 7+
  // días (aunque no tengan ninguna fecha cargada), para que se vea todo
  // junto en un solo lugar. Los vencidos van primero, después los casos
  // sin movimiento, y al final los próximos a vencer.
  interface ItemAtencion {
    key: string;
    casoId: string;
    numero: string;
    detalle: string;
    meta: string;
    badgeTexto: string;
    badgeClase: string;
    prioridad: number;
  }

  const itemsAtencion: ItemAtencion[] = [];

  for (const v of (vencimientos as unknown as VencimientoRow[] | null) ?? []) {
    const vencida = !!v.fecha_fin && new Date(v.fecha_fin + "T00:00:00") < hoy;
    itemsAtencion.push({
      key: `venc-${v.id}`,
      casoId: v.caso_id,
      numero: v.caso?.numero_siniestro ?? "Caso",
      detalle: v.tipo_evento,
      meta: `${v.caso?.asegurado?.nombre ?? ""} · ${v.caso?.responsable?.nombre ?? "Sin responsable"}`,
      badgeTexto: v.fecha_fin
        ? new Date(v.fecha_fin + "T00:00:00").toLocaleDateString("es-AR")
        : "",
      badgeClase: vencida ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
      prioridad: vencida ? 0 : 2
    });
  }

  for (const c of casosSinMovimiento) {
    itemsAtencion.push({
      key: `mov-${c.id}`,
      casoId: c.id,
      numero: c.numero_siniestro,
      detalle: "Sin movimiento en la bitácora",
      meta: `${c.asegurado?.nombre ?? ""} · ${c.responsable?.nombre ?? "Sin responsable"}`,
      badgeTexto: `${c.dias} días sin movimiento`,
      badgeClase: "bg-amber-100 text-amber-800",
      prioridad: 1
    });
  }

  itemsAtencion.sort((a, b) => a.prioridad - b.prioridad);
  const itemsAtencionLimitados = itemsAtencion.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Panel de control</h1>
        <p className="text-sm text-slate-500">
          Estado general de los casos y próximos vencimientos.
        </p>
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

      {(errorCasos || errorVenc || errorMov || errorCerrados || errorPresentacion) && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">
          {errorCasos?.message ||
            errorVenc?.message ||
            errorMov?.message ||
            errorCerrados?.message ||
            errorPresentacion?.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Casos totales" value={totalCasos} />
        <StatCard label="Casos abiertos" value={casosAbiertos} />
        <StatCard label="Casos cerrados" value={casosCerrados} />
      </div>

      {casosSinMovimiento.length > 0 && (
        <section className="card border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-amber-800">
              ⚠ Casos sin movimiento hace {DIAS_SIN_MOVIMIENTO}+ días ({casosSinMovimiento.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-100">
            {casosSinMovimiento.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between gap-3">
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
                <span className="badge bg-amber-100 text-amber-800 shrink-0">
                  {c.dias} días sin movimiento
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {casosSinContactar.length > 0 && (
        <section className="card border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-sky-800">
              📞 Casos sin contactar al asegurado ({casosSinContactar.length})
            </h2>
          </div>
          <div className="divide-y divide-sky-100">
            {casosSinContactar.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between gap-3">
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
                <span className="badge bg-sky-100 text-sky-800 shrink-0">Sin contactar</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {puedeVerTiempos && rankingGestores.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Casos por gestor</h2>
          <div className="overflow-x-auto mb-4">
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
                      {g.cerradosSinPagar > 0 ? (
                        <span className="badge bg-amber-100 text-amber-800">
                          {g.cerradosSinPagar}
                        </span>
                      ) : (
                        g.cerradosSinPagar
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            *No están en &quot;Documentación enviada a la Cía&quot; ni cerrados. **Casos cerrados
            sin un movimiento de &quot;Honorarios por Gestoría&quot; marcado como pagado.
          </p>

          <form className="flex flex-wrap items-end gap-3 mb-4" method="get">
            {searchParams.aseguradora_id && (
              <input type="hidden" name="aseguradora_id" value={searchParams.aseguradora_id} />
            )}
            {searchParams.mes && <input type="hidden" name="mes" value={searchParams.mes} />}
            {searchParams.tipo_baja_id && (
              <input type="hidden" name="tipo_baja_id" value={searchParams.tipo_baja_id} />
            )}
            <div className="flex-1 min-w-[220px]">
              <label className="label">Ver trámites pendientes de</label>
              <select
                name="gestor_id"
                defaultValue={searchParams.gestor_id ?? ""}
                className="input"
              >
                <option value="">Elegí un gestor...</option>
                {rankingGestores.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre} ({g.pendientes.length} pendientes)
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-secondary" type="submit">
              Ver
            </button>
          </form>

          {gestorSeleccionado && (
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
          )}
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
          {facturasPendientes && facturasPendientes.length > 0 ? (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Casos por estado</h2>
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
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
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
            <h2 className="font-medium text-slate-800">Próximos vencimientos</h2>
            <Link href="/agenda" className="text-sm text-brand-600 hover:underline">
              Ver agenda completa
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {itemsAtencionLimitados.map((item) => (
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
            {itemsAtencionLimitados.length === 0 && (
              <p className="text-sm text-slate-500 py-2">
                No hay vencimientos ni casos sin movimiento por ahora.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-1">Eventos sin completar</h2>
        <p className="text-xs text-slate-400 mb-3">
          Por cada tipo de evento, cuántos casos lo tienen cargado pero todavía no completado. Un
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

      {puedeVerTiempos && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">
            Tiempos de trámite (casos cerrados)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Trámite completo (promedio)"
              value={promedioTramite ?? 0}
              sufijo=" días"
            />
            <StatCard
              label="Casos cerrados analizados"
              value={casosConTiempos.length}
            />
            <StatCard
              label="Presentación → cierre (promedio)"
              value={promedioPresentacionCierre ?? 0}
              sufijo=" días"
            />
            <StatCard
              label="Casos con ese dato"
              value={casosConPresentacion.length}
            />
          </div>

          {casosCerradosRecientes.length > 0 ? (
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
                  {casosCerradosRecientes.map((c) => (
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
                      <td className="py-1.5 pr-4">
                        {c.diasPresentacionCierre ?? "—"}
                      </td>
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

      {puedeVerTiempos && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-1">
            Ganancia neta por mes (casos cerrados)
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Ganancia neta = plata efectivamente cobrada menos egresos, sobre los autos cerrados
            cada mes.
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
  sufijo
}: {
  label: string;
  value: number;
  sufijo?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {value}
        {sufijo && <span className="text-base font-normal text-slate-500">{sufijo}</span>}
      </p>
    </div>
  );
}
