import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import {
  calcularCierre,
  combinarRentabilidad,
  pendienteHoy,
  ultimosMeses,
  FilaDetalle,
  ResultadoCierre,
  SaldoDeclarado
} from "@/lib/cierreMensual";
import { obtenerDatosCierre, obtenerSaldosDeclarados } from "@/lib/cierreMensualDatos";
import SaldosDeclaradosForm, { FilaConciliacion } from "@/components/administracion/cierre/SaldosDeclaradosForm";
import CierreAcciones from "@/components/administracion/cierre/CierreAcciones";
import ComparativoGraficos from "@/components/administracion/cierre/ComparativoGraficos";
import TransferenciasInternas, { TransferenciaFila } from "@/components/administracion/cierre/TransferenciasInternas";

export const dynamic = "force-dynamic";

const LIMITE_FILAS = 200;

function pesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function porcentaje(valor: number | null): string {
  return valor === null ? "N/A" : `${valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
}

function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface SearchParams {
  mes?: string;
  aseguradora_id?: string;
  categoria?: string;
  caso?: string;
  estado?: string;
  caja_id?: string;
  ranking?: string;
}

function Kpi({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle?: string; tono?: "bueno" | "malo" }) {
  return (
    <div className="card p-4">
      <div className="label">{titulo}</div>
      <div
        className={`text-xl font-semibold tabular-nums ${
          tono === "malo" ? "text-red-600" : tono === "bueno" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {valor}
      </div>
      {detalle && <div className="text-xs text-slate-500 mt-1">{detalle}</div>}
    </div>
  );
}

export default async function CierreMensualPage({ searchParams }: { searchParams: SearchParams }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">Esta sección es información financiera interna.</p>
      </div>
    );
  }
  const esAdministrador = usuario.rol === "administrador";

  const mes = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "") ? searchParams.mes! : new Date().toISOString().slice(0, 7);
  const supabase = createClient();

  const [datos, declaradosLive, { data: cierre }, { data: cajasRaw }, { data: aseguradoras }] = await Promise.all([
    obtenerDatosCierre(supabase as unknown as SupabaseClient),
    obtenerSaldosDeclarados(supabase as unknown as SupabaseClient, mes),
    supabase
      .from("cierres_mensuales")
      .select("mes, cerrado_at, snapshot, cerrado_por_usuario:usuarios(nombre)")
      .eq("mes", mes)
      .maybeSingle(),
    supabase.from("cajas").select("id, nombre, tipo, moneda, activa").order("nombre"),
    supabase.from("aseguradoras").select("id, nombre").order("nombre")
  ]);

  const cerrado = !!cierre;
  const snapshot = (cierre?.snapshot ?? null) as { resultado: ResultadoCierre; declarados: SaldoDeclarado[] } | null;
  const live = calcularCierre(mes, datos, declaradosLive);
  const r: ResultadoCierre = snapshot?.resultado ?? live;
  const hoy = pendienteHoy(mes, datos);

  const cajas = (cajasRaw ?? []) as { id: string; nombre: string; tipo: string; moneda: string; activa: boolean }[];
  const cajaPorId = new Map(cajas.map((c) => [c.id, c]));
  const activas = new Set(cajas.filter((c) => c.activa).map((c) => c.id));

  const conciliacion: FilaConciliacion[] = r.cajas
    .filter((c) => activas.has(c.caja_id) || c.saldo_declarado !== null)
    .map((c) => ({
      ...c,
      tipo_esperado: c.grupo === "bancos" ? "extracto" : "arqueo"
    }));

  // ---- Detalle con filtros ----
  const pasa = (f: FilaDetalle) => {
    if (searchParams.aseguradora_id && f.aseguradora_id !== searchParams.aseguradora_id) return false;
    if (searchParams.categoria && f.categoria !== searchParams.categoria) return false;
    if (searchParams.caja_id && f.caja_id !== searchParams.caja_id) return false;
    if (searchParams.estado === "pendiente" && f.pendiente <= 0) return false;
    if (searchParams.estado === "cancelado" && f.pendiente > 0) return false;
    return true;
  };

  const comparativo = ultimosMeses(mes, 12).map((m) => calcularCierre(m, datos));

  // ---- Ranking de rentabilidad (mes seleccionado o últimos 12 meses) ----
  const rankingModo = searchParams.ranking === "12m" ? "12m" : "mes";
  const rentabilidad = combinarRentabilidad(rankingModo === "12m" ? comparativo : [r]);
  const mejoresCasos = rentabilidad.casos.slice(0, 10);
  const peoresCasos = rentabilidad.casos.length > 10 ? rentabilidad.casos.slice(-5).reverse() : [];

  const idsCaso = Array.from(
    new Set(
      [
        ...[...r.detalle.ingresos, ...r.detalle.egresos, ...r.detalle.anteriores].map((f) => f.caso_id),
        ...mejoresCasos.map((c) => c.caso_id),
        ...peoresCasos.map((c) => c.caso_id)
      ].filter((x): x is string => !!x)
    )
  );
  const casoLabel = new Map<string, string>();
  for (let i = 0; i < idsCaso.length; i += 200) {
    const { data } = await supabase
      .from("casos")
      .select("id, numero_siniestro, vehiculo:vehiculos(dominio)")
      .in("id", idsCaso.slice(i, i + 200));
    for (const c of (data ?? []) as unknown as { id: string; numero_siniestro: string; vehiculo: { dominio: string } | null }[]) {
      casoLabel.set(c.id, `${c.vehiculo?.dominio ?? "—"} · ${c.numero_siniestro}`);
    }
  }
  const textoCaso = searchParams.caso?.trim().toLowerCase();
  const pasaConCaso = (f: FilaDetalle) => {
    if (!pasa(f)) return false;
    if (textoCaso) return (f.caso_id ? casoLabel.get(f.caso_id) ?? "" : "").toLowerCase().includes(textoCaso);
    return true;
  };

  const ingresosDet = r.detalle.ingresos.filter(pasaConCaso);
  const egresosDet = r.detalle.egresos.filter(pasaConCaso);
  const anterioresDet = r.detalle.anteriores.filter(pasaConCaso);

  const categorias = Array.from(
    new Set([...r.detalle.ingresos, ...r.detalle.egresos, ...r.detalle.anteriores].map((f) => f.categoria).filter((x): x is string => !!x))
  ).sort();

  const aseguradoraNombre = new Map((aseguradoras ?? []).map((a) => [a.id, a.nombre]));

  // ---- Transferencias internas del mes ----
  const desde = `${mes}-01`;
  const hastaMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).toISOString().slice(0, 10);
  const { data: trfRaw } = await supabase
    .from("transferencias_internas")
    .select("id, fecha, caja_origen_id, caja_destino_id, monto, referencia, anulado, anulado_motivo")
    .gte("fecha", desde)
    .lte("fecha", hastaMes)
    .order("fecha");
  const transferencias: TransferenciaFila[] = (trfRaw ?? []).map((t) => ({
    id: t.id,
    fecha: t.fecha,
    origen: cajaPorId.get(t.caja_origen_id)?.nombre ?? "—",
    destino: cajaPorId.get(t.caja_destino_id)?.nombre ?? "—",
    monto: Number(t.monto),
    referencia: t.referencia,
    anulado: t.anulado,
    anulado_motivo: t.anulado_motivo
  }));

  // ---- Historial ----
  const { data: historial } = await supabase
    .from("cierres_mensuales_historial")
    .select("accion, motivo, detalle, created_at, usuario:usuarios(nombre)")
    .eq("mes", mes)
    .order("created_at", { ascending: false })
    .limit(15);

  // ---- Comparativo últimos 12 meses ----

  const hrefComprobante = (f: FilaDetalle) =>
    f.comprobante_id.startsWith("gen:")
      ? "/administracion?reporte=generales"
      : f.caso_id
        ? `/casos/${f.caso_id}/rentabilidad`
        : null;

  function TablaDetalle({ titulo, filas, vacio, etiquetaFecha }: { titulo: string; filas: FilaDetalle[]; vacio: string; etiquetaFecha: string }) {
    return (
      <section className="card p-4 mb-6">
        <h2 className="font-medium text-slate-800 mb-3">
          {titulo} <span className="text-xs text-slate-400">({filas.length})</span>
        </h2>
        {filas.length === 0 ? (
          <p className="text-sm text-slate-400">{vacio}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Comprobante</th>
                  <th className="py-1 pr-3 font-medium">Caso</th>
                  <th className="py-1 pr-3 font-medium">Contraparte / categoría</th>
                  <th className="py-1 pr-3 font-medium">Devengo</th>
                  <th className="py-1 pr-3 font-medium">{etiquetaFecha}</th>
                  <th className="py-1 pr-3 font-medium">Caja</th>
                  <th className="py-1 pr-3 font-medium text-right">Neto</th>
                  <th className="py-1 pr-3 font-medium text-right">IVA</th>
                  <th className="py-1 pr-3 font-medium text-right">Total</th>
                  <th className="py-1 pr-3 font-medium text-right">Aplicado</th>
                  <th className="py-1 pr-3 font-medium text-right">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, LIMITE_FILAS).map((f, i) => {
                  const href = hrefComprobante(f);
                  const etiqueta = f.numero
                    ? `N° ${f.numero}`
                    : f.comprobante_id.startsWith("gen:")
                      ? "Mov. general"
                      : f.comprobante_id.startsWith("ing:")
                        ? "Ingreso sin facturar"
                        : "Gasto";
                  return (
                    <tr key={`${f.comprobante_id}-${i}`} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3">
                        {href ? (
                          <Link href={href} className="text-brand-600 hover:underline">
                            {etiqueta}
                          </Link>
                        ) : (
                          etiqueta
                        )}
                      </td>
                      <td className="py-1.5 pr-3">{f.caso_id ? casoLabel.get(f.caso_id) ?? "—" : "Sin caso"}</td>
                      <td className="py-1.5 pr-3">
                        {f.contraparte ?? f.categoria ?? "—"}
                        {f.contraparte && f.categoria && <span className="block text-xs text-slate-400">{f.categoria}</span>}
                      </td>
                      <td className="py-1.5 pr-3">{new Date(f.fecha_devengo + "T00:00:00").toLocaleDateString("es-AR")}</td>
                      <td className="py-1.5 pr-3">
                        {f.fecha_aplicacion ? new Date(f.fecha_aplicacion + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="py-1.5 pr-3">{f.caja_id ? cajaPorId.get(f.caja_id)?.nombre ?? "—" : "—"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(f.neto)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(f.iva)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(f.total)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(f.aplicado)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(f.pendiente)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filas.length > LIMITE_FILAS && (
              <p className="text-xs text-slate-400 mt-2">
                Se muestran las primeras {LIMITE_FILAS} filas de {filas.length}.
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  const cierrePor = (cierre?.cerrado_por_usuario as unknown as { nombre: string } | null)?.nombre;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <Link href="/administracion" className="text-xs text-slate-400 hover:underline">
            ← Administración
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Cierre mensual — {nombreMes(mes)}</h1>
          <p className="text-sm text-slate-500">
            Resultado por <b>devengado</b> (neto de IVA, por fecha del comprobante) y liquidez por <b>caja</b> (por
            fecha en que la plata entra o sale). Un cobro de un mes anterior mueve la caja de este mes pero nunca su
            resultado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${cerrado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {cerrado ? "Cerrado" : "Abierto"}
          </span>
          <CierreAcciones mes={mes} cerrado={cerrado} esAdministrador={esAdministrador} />
        </div>
      </div>

      {cerrado && (
        <p className="text-sm text-slate-600 mb-4">
          Datos congelados al cierre ({cierre?.cerrado_at ? new Date(cierre.cerrado_at).toLocaleString("es-AR") : ""}
          {cierrePor ? ` por ${cierrePor}` : ""}). Los cobros y pagos posteriores no cambian este reporte.
        </p>
      )}

      <form className="card p-4 mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end" method="get">
        <div>
          <label className="label">Período</label>
          <input type="month" name="mes" defaultValue={mes} className="input" />
        </div>
        <div className="sm:flex-1 sm:min-w-[160px]">
          <label className="label">Aseguradora</label>
          <select name="aseguradora_id" defaultValue={searchParams.aseguradora_id ?? ""} className="input">
            <option value="">Todas</option>
            {(aseguradoras ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:flex-1 sm:min-w-[160px]">
          <label className="label">Categoría</label>
          <select name="categoria" defaultValue={searchParams.categoria ?? ""} className="input">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:flex-1 sm:min-w-[140px]">
          <label className="label">Caso (dominio / siniestro)</label>
          <input name="caso" defaultValue={searchParams.caso ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={searchParams.estado ?? ""} className="input">
            <option value="">Todos</option>
            <option value="pendiente">Con saldo pendiente</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
        <div className="sm:flex-1 sm:min-w-[160px]">
          <label className="label">Caja</label>
          <select name="caja_id" defaultValue={searchParams.caja_id ?? ""} className="input">
            <option value="">Todas</option>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" type="submit">
          Aplicar
        </button>
      </form>

      <section className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/api/cierre-mensual/${mes}/export?formato=xlsx`} className="btn-primary text-sm">
            Descargar Excel del cierre (.xlsx)
          </a>
          <span className="text-xs text-slate-500">
            {cerrado ? "Sale del reporte congelado al cierre." : "Mes abierto: sale en vivo."} El Resumen usa fórmulas
            SUMIFS sobre las hojas de detalle.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-600">
          <span className="font-medium">CSV por bloque:</span>
          {[
            ["A", "A Ingresos"],
            ["B", "B Egresos"],
            ["C", "C Otros períodos"],
            ["D", "D Cajas"],
            ["conciliacion", "Conciliación"],
            ["transferencias", "Transferencias"],
            ["comparativo", "Comparativo 12m"],
            ["rentabilidad", "Rentabilidad por caso"],
            ["rentabilidad_aseguradora", "Rentabilidad por aseguradora"]
          ].map(([bloque, texto]) => (
            <a
              key={bloque}
              href={`/api/cierre-mensual/${mes}/export?formato=csv&bloque=${bloque}`}
              className="text-brand-600 hover:underline"
            >
              {texto}
            </a>
          ))}
        </div>
        <form method="get" action="/api/cierre-mensual/export-rango" className="flex flex-wrap items-end gap-3 mt-4">
          <span className="text-xs font-medium text-slate-600 self-center">Comparar un rango de meses:</span>
          <div>
            <label className="label">Desde</label>
            <input type="month" name="desde" required defaultValue={ultimosMeses(mes, 6)[0]} className="input w-40" />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="month" name="hasta" required defaultValue={mes} className="input w-40" />
          </div>
          <div>
            <label className="label">Formato</label>
            <select name="formato" className="input w-28" defaultValue="xlsx">
              <option value="xlsx">Excel</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <button className="btn-secondary text-sm" type="submit">
            Exportar rango
          </button>
        </form>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi titulo="Ingresos del mes" valor={pesos(r.ingresos)} detalle="Devengado, neto de IVA" />
        <Kpi titulo="Egresos del mes" valor={pesos(r.egresos)} detalle="Devengado, neto de IVA" />
        <Kpi titulo="Ganancia real" valor={pesos(r.ganancia)} tono={r.ganancia >= 0 ? "bueno" : "malo"} />
        <Kpi titulo="ROI operativo" valor={porcentaje(r.roi)} detalle="Ganancia / egresos" tono={r.roi !== null && r.roi < 0 ? "malo" : undefined} />
        <Kpi titulo="Margen" valor={porcentaje(r.margen)} detalle="Ganancia / ingresos" />
        <Kpi
          titulo="Saldo de cajas"
          valor={pesos(r.saldo_cajas_total)}
          detalle={`Bancos ${pesos(r.saldo_bancos)} · Efectivo ${pesos(r.saldo_efectivo)}`}
        />
        <Kpi
          titulo="Por cobrar acumulado"
          valor={pesos(r.por_cobrar_acumulado)}
          detalle={`Al cierre del mes${
            r.por_cobrar_sin_facturar ? ` · incluye ${pesos(r.por_cobrar_sin_facturar)} sin facturar` : ""
          }`}
        />
        <Kpi titulo="Cuentas por pagar acumulado" valor={pesos(r.por_pagar_acumulado)} detalle="Todos los períodos, al cierre del mes" />
        <Kpi
          titulo="Capital de trabajo"
          valor={pesos(r.capital_de_trabajo)}
          detalle="Cajas + por cobrar − por pagar"
          tono={r.capital_de_trabajo >= 0 ? undefined : "malo"}
        />
      </div>

      <div className="card p-4 mb-6 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1 text-slate-700">
          <div>
            <b>A – Ingresos:</b> cobrado en el mes {pesos(r.A1_cobrado_mes)} + pendiente al cierre {pesos(r.A2_pendiente_cierre)}
            {r.A3_cobrado_antes !== 0 && <> + cobrado antes {pesos(r.A3_cobrado_antes)}</>}
            {r.A4_notas_credito_anteriores !== 0 && <> + notas de crédito de períodos anteriores {pesos(r.A4_notas_credito_anteriores)}</>}
          </div>
          <div>
            <b>B – Egresos:</b> pagado en el mes {pesos(r.B1_pagado_mes)} + pendiente al cierre {pesos(r.B2_pendiente_cierre)}
            {r.B3_pagado_antes !== 0 && <> + pagado antes {pesos(r.B3_pagado_antes)}</>}
          </div>
          <div>
            <b>C – Caja de otros períodos (solo liquidez):</b> cobranzas anteriores {pesos(r.C1_cobranzas_anteriores)} · pagos anteriores{" "}
            {pesos(r.C2_pagos_anteriores)}
            {(r.C3_cobranzas_anticipadas !== 0 || r.C4_pagos_anticipados !== 0) && (
              <> · anticipados {pesos(r.C3_cobranzas_anticipadas)} / {pesos(r.C4_pagos_anticipados)}</>
            )}
            {r.anticipos_recibidos !== 0 && <> · anticipos recibidos {pesos(r.anticipos_recibidos)}</>}
          </div>
        </div>
        <p className={`mt-3 ${r.control_diferencia === 0 ? "text-emerald-700" : "text-red-600 font-medium"}`}>
          Control de caja: saldo inicial {pesos(r.saldo_inicial_total)} + entradas − salidas (sin transferencias internas)
          {r.control_diferencia === 0 ? " = saldo final calculado ✓" : ` — diferencia de ${pesos(r.control_diferencia)} con el saldo final calculado`}
        </p>
        <p className="mt-1 text-slate-600">
          <b>Devengo diferido</b> (casos todavía abiertos, neto): ingresos {pesos(r.diferido_ingresos_neto ?? 0)} · egresos{" "}
          {pesos(r.diferido_egresos_neto ?? 0)}. No están en el resultado: entran en el mes en que cierra cada caso.
        </p>
        <p className="mt-1 text-slate-600">
          Pendiente de los comprobantes de {nombreMes(mes)} (con IVA): <b>al cierre</b> por cobrar{" "}
          {pesos(r.pendiente_cierre_cobrar_bruto)} y por pagar {pesos(r.pendiente_cierre_pagar_bruto)} · <b>hoy</b> por cobrar{" "}
          {pesos(hoy.porCobrar)} y por pagar {pesos(hoy.porPagar)}.
        </p>
      </div>

      <section className="card p-4 mb-6">
        <h2 className="font-medium text-slate-800 mb-1">Conciliación de cajas</h2>
        <p className="text-sm text-slate-500 mb-3">
          Cargá el saldo real de cada caja: extracto bancario en las cuentas de banco y arqueo físico en las de efectivo.
          Hacen falta todas las cajas activas para poder cerrar el mes.
        </p>
        <SaldosDeclaradosForm mes={mes} filas={conciliacion} bloqueado={cerrado} />
      </section>

      <TablaDetalle titulo="A – Ingresos del mes (cobros de comprobantes del mes)" filas={ingresosDet} vacio="No hay cobros de comprobantes de este mes con estos filtros." etiquetaFecha="Fecha de cobro" />
      <TablaDetalle titulo="B – Egresos del mes (pagos de comprobantes del mes)" filas={egresosDet} vacio="No hay pagos de comprobantes de este mes con estos filtros." etiquetaFecha="Fecha de pago" />
      <TablaDetalle titulo="C – Movimientos de otros períodos (solo caja)" filas={anterioresDet} vacio="No hay cobros ni pagos de comprobantes de otros períodos en este mes." etiquetaFecha="Fecha de cobro/pago" />

      <section className="card p-4 mb-6">
        <h2 className="font-medium text-slate-800 mb-3">Transferencias internas entre cajas</h2>
        <TransferenciasInternas
          mes={mes}
          cajas={cajas.filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda }))}
          transferencias={transferencias}
          bloqueado={cerrado}
        />
      </section>

      <section className="card p-4 mb-6">
        <h2 className="font-medium text-slate-800 mb-3">Comparativo de los últimos 12 meses</h2>
        <div className="mb-6">
          <ComparativoGraficos
            puntos={comparativo.map((c) => ({ mes: c.mes, ganancia: c.ganancia, roi: c.roi, saldo: c.saldo_cajas_total }))}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Mes</th>
                <th className="py-1 pr-3 font-medium text-right">Ingresos</th>
                <th className="py-1 pr-3 font-medium text-right">Egresos</th>
                <th className="py-1 pr-3 font-medium text-right">Ganancia</th>
                <th className="py-1 pr-3 font-medium text-right">ROI</th>
                <th className="py-1 pr-3 font-medium text-right">Margen</th>
                <th className="py-1 pr-3 font-medium text-right">Saldo de cajas</th>
              </tr>
            </thead>
            <tbody>
              {comparativo.map((c) => (
                <tr key={c.mes} className={`border-t border-slate-100 ${c.mes === mes ? "bg-slate-50 font-medium" : ""}`}>
                  <td className="py-1.5 pr-3">
                    <Link href={`/administracion/cierre?mes=${c.mes}`} className="text-brand-600 hover:underline">
                      {nombreMes(c.mes)}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.ingresos)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.egresos)}</td>
                  <td className={`py-1.5 pr-3 text-right tabular-nums ${c.ganancia < 0 ? "text-red-600" : ""}`}>{pesos(c.ganancia)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{porcentaje(c.roi)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{porcentaje(c.margen)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.saldo_cajas_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">Los meses ya cerrados se recalculan en vivo acá; el reporte congelado es el de arriba.</p>
      </section>

      <section className="card p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium text-slate-800">Ranking de rentabilidad</h2>
          <div className="flex gap-2">
            {(["mes", "12m"] as const).map((modo) => (
              <Link
                key={modo}
                href={`/administracion/cierre?${new URLSearchParams({
                  ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => typeof v === "string" && v)),
                  mes,
                  ranking: modo
                } as Record<string, string>).toString()}`}
                className={`btn-secondary text-xs ${rankingModo === modo ? "!bg-brand-900 !text-white" : ""}`}
              >
                {modo === "mes" ? nombreMes(mes) : "Últimos 12 meses"}
              </Link>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Resultado = ingresos − egresos netos de IVA de los comprobantes devengados en el período, por aseguradora y
          por caso. Solo entran los comprobantes asociados a un caso.
        </p>

        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Por aseguradora</h3>
        {rentabilidad.aseguradoras.length === 0 ? (
          <p className="text-sm text-slate-400 mb-4">Sin comprobantes con caso en este período.</p>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">#</th>
                  <th className="py-1 pr-3 font-medium">Aseguradora</th>
                  <th className="py-1 pr-3 font-medium text-right">Casos</th>
                  <th className="py-1 pr-3 font-medium text-right">Ingresos</th>
                  <th className="py-1 pr-3 font-medium text-right">Egresos</th>
                  <th className="py-1 pr-3 font-medium text-right">Resultado</th>
                  <th className="py-1 pr-3 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidad.aseguradoras.map((a, i) => (
                  <tr key={a.aseguradora_id ?? "sin"} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-1.5 pr-3">
                      {a.aseguradora_id ? aseguradoraNombre.get(a.aseguradora_id) ?? "—" : "Sin aseguradora"}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{a.casos}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(a.ingresos)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(a.egresos)}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${a.resultado < 0 ? "text-red-600" : ""}`}>
                      {pesos(a.resultado)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{porcentaje(a.margen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {[
          { titulo: "Casos más rentables", lista: mejoresCasos },
          { titulo: "Casos menos rentables", lista: peoresCasos }
        ].map(({ titulo, lista }) =>
          lista.length === 0 ? null : (
            <div key={titulo} className="mb-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">{titulo}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Caso</th>
                      <th className="py-1 pr-3 font-medium">Aseguradora</th>
                      <th className="py-1 pr-3 font-medium text-right">Ingresos</th>
                      <th className="py-1 pr-3 font-medium text-right">Egresos</th>
                      <th className="py-1 pr-3 font-medium text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((c) => (
                      <tr key={c.caso_id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3">
                          <Link href={`/casos/${c.caso_id}/rentabilidad`} className="text-brand-600 hover:underline">
                            {casoLabel.get(c.caso_id) ?? c.caso_id}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3">
                          {c.aseguradora_id ? aseguradoraNombre.get(c.aseguradora_id) ?? "—" : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.ingresos)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{pesos(c.egresos)}</td>
                        <td className={`py-1.5 pr-3 text-right tabular-nums ${c.resultado < 0 ? "text-red-600" : ""}`}>
                          {pesos(c.resultado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </section>

      <section className="card p-4 mb-6">
        <h2 className="font-medium text-slate-800 mb-3">Bitácora del período</h2>
        {(historial ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos en la bitácora de este mes.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-600">
            {(historial ?? []).map((h, i) => {
              const quien = (h.usuario as unknown as { nombre: string } | null)?.nombre ?? "—";
              const detalle = h.detalle as Record<string, unknown> | null;
              const texto =
                h.accion === "cerrar"
                  ? "Cerró el mes"
                  : h.accion === "reabrir"
                    ? "Reabrió el mes"
                    : h.accion === "arqueo"
                      ? `Cargó saldo real de ${detalle?.caja ?? "una caja"} (${detalle?.tipo}): ${
                          detalle?.saldo_anterior === null || detalle?.saldo_anterior === undefined
                            ? ""
                            : `${pesos(Number(detalle.saldo_anterior))} → `
                        }${pesos(Number(detalle?.saldo_nuevo))}`
                      : detalle?.anulada
                        ? "Anuló una transferencia interna"
                        : `Registró una transferencia interna de ${pesos(Number(detalle?.monto))}`;
              return (
                <li key={i}>
                  <span className="text-slate-400">{new Date(h.created_at).toLocaleString("es-AR")}</span> · {quien} — {texto}
                  {h.motivo ? ` (motivo: ${h.motivo})` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        Aseguradora filtrada: {searchParams.aseguradora_id ? aseguradoraNombre.get(searchParams.aseguradora_id) : "todas"}. Los filtros
        aplican a las tablas de detalle; los KPI y la conciliación son del mes completo.
      </p>
    </div>
  );
}
