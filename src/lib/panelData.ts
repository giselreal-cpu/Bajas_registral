import { createClient } from "@/lib/supabase/server";
import { Caso, ESTADOS } from "@/types/database";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";
import { horasHabilesTranscurridas } from "@/lib/fechas";

// Toda la data del Panel de control (`/panel`) y de su página de
// detalle (`/panel/detalle`) sale de acá — mismas queries, mismos
// filtros (compañía/mes/tipo de baja), para que ambas páginas queden
// consistentes entre sí. El Panel muestra resúmenes/promedios; la
// página de detalle expande cada uno en listas completas de casos
// (mismo patrón que "Rentabilidad" en el detalle de un caso vs. su
// página `/casos/[id]/rentabilidad`).

export interface PanelFiltros {
  aseguradora_id?: string;
  mes?: string;
  tipo_baja_id?: string;
}

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

export interface CasoResumen {
  id: string;
  estado: string;
  numero_siniestro: string;
  created_at: string;
  gestor_id: string | null;
  gestor: { nombre: string } | null;
  asegurado: { nombre: string } | null;
  responsable: { nombre: string } | null;
}

export interface EventoIncompletoRow {
  casoId: string;
  numeroSiniestro: string;
  dominio: string;
  estado: string;
}

export interface EncuestaRow {
  id: string;
  token: string;
  calificacion_contacto: number | null;
  calificacion_traslado: number | null;
  calificacion_gestoria: number | null;
  comentario: string | null;
  respondida: boolean;
  ultimo_contacto_at: string;
  created_at: string;
  caso: {
    id: string;
    numero_siniestro: string;
    vehiculo: { dominio: string } | null;
    asegurado: { nombre: string; telefono: string | null } | null;
  } | null;
}

export interface ResumenMes {
  mes: string;
  autosCerrados: number;
  gananciaNeta: number;
  cobradoDesarmadero: number;
}

export interface ItemAtencion {
  key: string;
  casoId: string;
  numero: string;
  detalle: string;
  meta: string;
  badgeTexto: string;
  badgeClase: string;
  prioridad: number;
}

const DIAS_SIN_MOVIMIENTO = 7;

export const promedio = (valores: number[]) =>
  valores.length === 0
    ? null
    : Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;

function diasEntre(desde: string, hasta: string) {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / (1000 * 60 * 60 * 24));
}

export const nombreMes = (mesKey: string) => {
  const [anio, mes] = mesKey.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric"
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export async function obtenerDatosPanel(filtros: PanelFiltros) {
  const supabase = createClient();

  let casosQuery = supabase
    .from("casos")
    .select(
      "id, estado, numero_siniestro, created_at, fecha_ingreso, aseguradora_id, tipo_baja_id, gestor_id, gestor:gestores(nombre), asegurado:asegurados(nombre), responsable:usuarios(nombre)"
    );

  if (filtros.aseguradora_id) {
    casosQuery = casosQuery.eq("aseguradora_id", filtros.aseguradora_id);
  }
  if (filtros.tipo_baja_id) {
    casosQuery = casosQuery.eq("tipo_baja_id", filtros.tipo_baja_id);
  }
  if (filtros.mes) {
    const [anio, mes] = filtros.mes.split("-").map(Number);
    const desde = `${filtros.mes}-01`;
    const hastaDate = new Date(anio, mes, 1);
    const hasta = hastaDate.toISOString().slice(0, 10);
    casosQuery = casosQuery.gte("fecha_ingreso", desde).lt("fecha_ingreso", hasta);
  }

  let casosCerradosQuery = supabase
    .from("casos")
    .select("id, numero_siniestro, fecha_ingreso, fecha_cierre")
    .eq("estado", "cerrado")
    .not("fecha_cierre", "is", null);

  if (filtros.aseguradora_id) {
    casosCerradosQuery = casosCerradosQuery.eq("aseguradora_id", filtros.aseguradora_id);
  }
  if (filtros.tipo_baja_id) {
    casosCerradosQuery = casosCerradosQuery.eq("tipo_baja_id", filtros.tipo_baja_id);
  }
  if (filtros.mes) {
    const [anio, mes] = filtros.mes.split("-").map(Number);
    const desde = `${filtros.mes}-01`;
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
    { data: contactosExistentes, error: errorContactos },
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

  const hayFiltrosPanel = !!(filtros.aseguradora_id || filtros.mes || filtros.tipo_baja_id);

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

  const casosConContactoIniciado = new Set((contactosExistentes ?? []).map((c) => c.caso_id));
  const casosSinContactar = errorContactos
    ? []
    : ((casos as CasoResumen[] | null) ?? []).filter(
        (c) => c.estado !== "cerrado" && !casosConContactoIniciado.has(c.id)
      );

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

  const promedioTramite = promedio(casosConTiempos.map((c) => c.diasTramite));
  const casosConPresentacion = casosConTiempos.filter((c) => c.diasPresentacionCierre !== null);
  const promedioPresentacionCierre = promedio(
    casosConPresentacion.map((c) => c.diasPresentacionCierre as number)
  );

  const casosCerradosOrdenados = [...casosConTiempos].sort((a, b) =>
    b.fecha_cierre! > a.fecha_cierre! ? 1 : -1
  );
  const casosCerradosRecientes = casosCerradosOrdenados.slice(0, 8);

  const casoIds = (casos ?? []).map((c) => c.id);
  const casoIdsCerrados = casosConTiempos.map((c) => c.id);
  const casoIdsCerradosConGestor = Array.from(casosPorGestorMap.values()).flatMap((v) =>
    v.cerrados.map((c) => c.id)
  );

  const [
    { data: facturasCerrados },
    { data: movimientosCerrados },
    { data: facturasPendientes },
    { data: eventosSinCompletar },
    { data: honorariosGestoria },
    { data: encuestas }
  ] = await Promise.all([
    casoIdsCerrados.length > 0
      ? supabase
          .from("facturas")
          .select("caso_id, tipo_receptor, monto_total, cobros(monto), notas_credito(monto)")
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
      : Promise.resolve({ data: [] as any[] }),
    casoIds.length > 0
      ? supabase
          .from("encuestas_satisfaccion")
          .select(
            `
            id, token, calificacion_contacto, calificacion_traslado, calificacion_gestoria,
            comentario, respondida, ultimo_contacto_at, created_at,
            caso:casos(id, numero_siniestro, vehiculo:vehiculos(dominio), asegurado:asegurados(nombre, telefono))
          `
          )
          .in("caso_id", casoIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

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
      cerradosSinPagar: v.cerrados.filter((c) => !casosGestoriaPagada.has(c.id))
    }))
    .sort((a, b) => b.pendientes.length - a.pendientes.length);

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

  const encuestasRows = (encuestas ?? []) as unknown as EncuestaRow[];
  const encuestasEnviadas = encuestasRows.length;
  const encuestasRespondidas = encuestasRows.filter((e) => e.respondida).length;
  const encuestasSinResponder = encuestasEnviadas - encuestasRespondidas;
  const promedioEncuesta = (
    campo: "calificacion_contacto" | "calificacion_traslado" | "calificacion_gestoria"
  ) =>
    promedio(
      encuestasRows.filter((e) => e.respondida && e[campo] !== null).map((e) => e[campo] as number)
    );
  const promedioContacto = promedioEncuesta("calificacion_contacto");
  const promedioTraslado = promedioEncuesta("calificacion_traslado");
  const promedioGestoria = promedioEncuesta("calificacion_gestoria");
  const comentariosDestacados = encuestasRows
    .filter((e) => e.respondida && e.comentario)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 5);
  const ahora = new Date();
  const encuestasPendientesRecordatorio = encuestasRows
    .filter((e) => !e.respondida)
    .map((e) => ({ ...e, horasHabiles: horasHabilesTranscurridas(e.ultimo_contacto_at, ahora) }))
    .filter((e) => e.horasHabiles >= 48)
    .sort((a, b) => b.horasHabiles - a.horasHabiles);

  // Ingresos cobrados (para "Rentabilidad": cash-basis, solo plata
  // efectivamente cobrada) vs. facturado total — con o sin cobrar (para
  // "Ganancia neta por mes": ahí interesa ver el valor total facturado
  // de un auto ya cerrado, esté o no cobrado todavía).
  const ingresosPorCaso = new Map<string, number>();
  const facturadoPorCaso = new Map<string, number>();
  const cobradoDesarmaderoPorCaso = new Map<string, number>();
  for (const f of (facturasCerrados ?? []) as unknown as {
    caso_id: string;
    tipo_receptor: string;
    monto_total: number;
    cobros: { monto: number }[];
    notas_credito: { monto: number }[];
  }[]) {
    const cobrado =
      (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
      (f.notas_credito ?? []).reduce((acc, n) => acc + Number(n.monto), 0);
    ingresosPorCaso.set(f.caso_id, (ingresosPorCaso.get(f.caso_id) ?? 0) + cobrado);
    facturadoPorCaso.set(f.caso_id, (facturadoPorCaso.get(f.caso_id) ?? 0) + Number(f.monto_total));
    if (f.tipo_receptor === "desarmadero") {
      cobradoDesarmaderoPorCaso.set(
        f.caso_id,
        (cobradoDesarmaderoPorCaso.get(f.caso_id) ?? 0) + cobrado
      );
    }
  }
  // Egresos pagados (para "Rentabilidad": ese resumen es cash-basis, solo
  // plata efectivamente pagada) vs. egresos totales — pagados + pendientes
  // de pago (para "Ganancia neta por mes": ahí interesa ver el costo real
  // del auto ya cerrado, sin importar si ese egreso todavía no se pagó).
  const egresosPorCaso = new Map<string, number>();
  const egresosTotalesPorCaso = new Map<string, number>();
  for (const m of (movimientosCerrados ?? []) as unknown as {
    caso_id: string;
    monto: number;
    pagado: boolean;
    concepto: { tipo: string } | null;
  }[]) {
    if (m.concepto?.tipo !== "egreso") continue;
    egresosTotalesPorCaso.set(
      m.caso_id,
      (egresosTotalesPorCaso.get(m.caso_id) ?? 0) + Number(m.monto)
    );
    if (m.pagado) {
      egresosPorCaso.set(m.caso_id, (egresosPorCaso.get(m.caso_id) ?? 0) + Number(m.monto));
    }
  }

  const totalIngresosPanel = Array.from(ingresosPorCaso.values()).reduce((a, b) => a + b, 0);
  const totalEgresosPanel = Array.from(egresosPorCaso.values()).reduce((a, b) => a + b, 0);
  const gananciaNetaPanel = totalIngresosPanel - totalEgresosPanel;

  const resumenPorMes = new Map<string, ResumenMes>();
  for (const c of casosConTiempos) {
    const mesKey = c.fecha_cierre!.slice(0, 7);
    if (!resumenPorMes.has(mesKey)) {
      resumenPorMes.set(mesKey, { mes: mesKey, autosCerrados: 0, gananciaNeta: 0, cobradoDesarmadero: 0 });
    }
    const entrada = resumenPorMes.get(mesKey)!;
    entrada.autosCerrados += 1;
    entrada.gananciaNeta += (facturadoPorCaso.get(c.id) ?? 0) - (egresosTotalesPorCaso.get(c.id) ?? 0);
    entrada.cobradoDesarmadero += cobradoDesarmaderoPorCaso.get(c.id) ?? 0;
  }
  const resumenMensual = Array.from(resumenPorMes.values()).sort((a, b) => b.mes.localeCompare(a.mes));

  const itemsAtencion: ItemAtencion[] = [];
  for (const v of (vencimientos as unknown as VencimientoRow[] | null) ?? []) {
    const vencida = !!v.fecha_fin && new Date(v.fecha_fin + "T00:00:00") < hoy;
    itemsAtencion.push({
      key: `venc-${v.id}`,
      casoId: v.caso_id,
      numero: v.caso?.numero_siniestro ?? "Caso",
      detalle: v.tipo_evento,
      meta: `${v.caso?.asegurado?.nombre ?? ""} · ${v.caso?.responsable?.nombre ?? "Sin responsable"}`,
      badgeTexto: v.fecha_fin ? new Date(v.fecha_fin + "T00:00:00").toLocaleDateString("es-AR") : "",
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

  return {
    errores: { errorCasos, errorVenc, errorMov, errorCerrados, errorPresentacion, errorContactos },
    aseguradoras: aseguradoras ?? [],
    tiposBaja: tiposBaja ?? [],
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
    casosCerradosOrdenados,
    casosCerradosRecientes,
    promedioTramite,
    casosConPresentacion,
    promedioPresentacionCierre,
    eventosPorTipo,
    encuestasRows,
    encuestasEnviadas,
    encuestasRespondidas,
    encuestasSinResponder,
    promedioContacto,
    promedioTraslado,
    promedioGestoria,
    comentariosDestacados,
    encuestasPendientesRecordatorio,
    facturasPendientes: facturasPendientes ?? [],
    totalIngresosPanel,
    totalEgresosPanel,
    gananciaNetaPanel,
    resumenMensual,
    itemsAtencionLimitados
  };
}
