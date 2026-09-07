import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { obtenerDatosPanel, promedio } from "@/lib/panelData";
import { TIPOS_EVENTO } from "@/lib/eventosBitacora";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// Página nueva del rediseño (turno 7 del mockup) — lee datos que ya se
// calculan hoy en otras pantallas (rentabilidad por caso, tiempos de
// trámite, ranking de gestores, cuenta corriente), sin cargar ni
// escribir nada nuevo. Mismo criterio de acceso que Administración: la
// compañía no ve información financiera interna.
export default async function AnalisisPage() {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">
          Esta sección es información financiera interna.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { rankingGestores } = await obtenerDatosPanel({});

  // Rentabilidad por compañía: casos cerrados agrupados por aseguradora.
  const { data: casosCerrados } = await supabase
    .from("casos")
    .select("id, aseguradora_id, aseguradora:aseguradoras(nombre)")
    .eq("estado", "cerrado")
    .not("fecha_cierre", "is", null);

  const casoIdsCerrados = (casosCerrados ?? []).map((c) => c.id);

  const [{ data: facturasCerradas }, { data: movimientosCerrados }] = await Promise.all([
    casoIdsCerrados.length > 0
      ? supabase.from("facturas").select("caso_id, monto_total").in("caso_id", casoIdsCerrados)
      : Promise.resolve({ data: [] as { caso_id: string; monto_total: number }[] }),
    casoIdsCerrados.length > 0
      ? supabase
          .from("movimientos_caso")
          .select("caso_id, monto, concepto:conceptos_movimiento(tipo)")
          .eq("aprobado", true)
          .in("caso_id", casoIdsCerrados)
      : Promise.resolve({ data: [] as { caso_id: string; monto: number; concepto: { tipo: string } | null }[] })
  ]);

  const facturadoPorCaso = new Map<string, number>();
  for (const f of facturasCerradas ?? []) {
    facturadoPorCaso.set(f.caso_id, (facturadoPorCaso.get(f.caso_id) ?? 0) + Number(f.monto_total));
  }
  const gastosPorCaso = new Map<string, number>();
  for (const m of (movimientosCerrados ?? []) as unknown as {
    caso_id: string;
    monto: number;
    concepto: { tipo: string } | null;
  }[]) {
    if (m.concepto?.tipo !== "egreso") continue;
    gastosPorCaso.set(m.caso_id, (gastosPorCaso.get(m.caso_id) ?? 0) + Number(m.monto));
  }

  interface ResumenAseguradora {
    id: string;
    nombre: string;
    casos: number;
    facturado: number;
    gastos: number;
  }
  const porAseguradora = new Map<string, ResumenAseguradora>();
  for (const c of (casosCerrados ?? []) as unknown as {
    id: string;
    aseguradora_id: string;
    aseguradora: { nombre: string } | null;
  }[]) {
    if (!porAseguradora.has(c.aseguradora_id)) {
      porAseguradora.set(c.aseguradora_id, {
        id: c.aseguradora_id,
        nombre: c.aseguradora?.nombre ?? "—",
        casos: 0,
        facturado: 0,
        gastos: 0
      });
    }
    const entrada = porAseguradora.get(c.aseguradora_id)!;
    entrada.casos += 1;
    entrada.facturado += facturadoPorCaso.get(c.id) ?? 0;
    entrada.gastos += gastosPorCaso.get(c.id) ?? 0;
  }
  const rentabilidadPorCompania = Array.from(porAseguradora.values())
    .map((a) => ({
      ...a,
      resultado: a.facturado - a.gastos,
      margen: a.facturado > 0 ? Math.round(((a.facturado - a.gastos) / a.facturado) * 1000) / 10 : null
    }))
    .sort((a, b) => b.resultado - a.resultado);

  // Días promedio por etapa: duración de cada tipo de evento completado
  // (fecha_inicio → fecha_fin), promediado entre todos los casos.
  const { data: eventosCompletos } = await supabase
    .from("bitacora")
    .select("tipo_evento, fecha_inicio, fecha_fin")
    .eq("completado", true)
    .not("fecha_inicio", "is", null)
    .not("fecha_fin", "is", null);

  const duracionesPorTipo = new Map<string, number[]>();
  for (const ev of (eventosCompletos ?? []) as { tipo_evento: string; fecha_inicio: string; fecha_fin: string }[]) {
    const dias = Math.round(
      (new Date(ev.fecha_fin).getTime() - new Date(ev.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dias < 0) continue;
    const lista = duracionesPorTipo.get(ev.tipo_evento) ?? [];
    lista.push(dias);
    duracionesPorTipo.set(ev.tipo_evento, lista);
  }
  const diasPorEtapa = TIPOS_EVENTO.map((t) => ({
    label: t.label,
    promedio: promedio(duracionesPorTipo.get(t.label) ?? []),
    cantidad: (duracionesPorTipo.get(t.label) ?? []).length
  })).filter((e) => e.cantidad > 0);
  const maxDias = Math.max(1, ...diasPorEtapa.map((e) => e.promedio ?? 0));

  // Cuenta corriente: mismo resumen por tercero que ya usa
  // /cuenta-corriente, acá solo el resumen (sin el detalle de facturas).
  const [{ data: facturasCC }, { data: aseguradorasCC }, { data: desarmaderosCC }] = await Promise.all([
    supabase.from("facturas").select("tipo_receptor, receptor_id, monto_total, cobros(monto), notas_credito(monto)"),
    supabase.from("aseguradoras").select("id, nombre"),
    supabase.from("desarmaderos").select("id, nombre")
  ]);

  const nombreDe = (tipo: string, id: string) => {
    const lista = tipo === "compania" ? aseguradorasCC : desarmaderosCC;
    return lista?.find((x) => x.id === id)?.nombre ?? "—";
  };

  interface ResumenTercero {
    tipo: string;
    id: string;
    nombre: string;
    facturado: number;
    cobrado: number;
  }
  const porTercero = new Map<string, ResumenTercero>();
  for (const f of (facturasCC ?? []) as unknown as {
    tipo_receptor: string;
    receptor_id: string;
    monto_total: number;
    cobros: { monto: number }[];
    notas_credito: { monto: number }[];
  }[]) {
    const clave = `${f.tipo_receptor}:${f.receptor_id}`;
    if (!porTercero.has(clave)) {
      porTercero.set(clave, {
        tipo: f.tipo_receptor,
        id: f.receptor_id,
        nombre: nombreDe(f.tipo_receptor, f.receptor_id),
        facturado: 0,
        cobrado: 0
      });
    }
    const entrada = porTercero.get(clave)!;
    entrada.facturado += Number(f.monto_total);
    entrada.cobrado +=
      (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
      (f.notas_credito ?? []).reduce((acc, n) => acc + Number(n.monto), 0);
  }
  const cuentaCorriente = Array.from(porTercero.values())
    .map((t) => ({ ...t, saldo: t.facturado - t.cobrado }))
    .filter((t) => Math.abs(t.saldo) > 0.01)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold text-brand-900">Análisis</h1>
        <p className="text-sm text-slate-500">
          Rentabilidad, tiempos de trámite y cuenta corriente de toda la cartera.
        </p>
      </div>

      <section className="card p-4">
        <h2 className="font-heading font-semibold text-slate-800 mb-3">Rentabilidad por compañía</h2>
        {rentabilidadPorCompania.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-4 font-medium">Compañía</th>
                  <th className="py-1 pr-4 font-medium">Casos cerrados</th>
                  <th className="py-1 pr-4 font-medium">Facturado</th>
                  <th className="py-1 pr-4 font-medium">Gastos</th>
                  <th className="py-1 pr-4 font-medium">Resultado</th>
                  <th className="py-1 pr-4 font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidadPorCompania.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-4 font-medium text-slate-800">{a.nombre}</td>
                    <td className="py-1.5 pr-4">{a.casos}</td>
                    <td className="py-1.5 pr-4">{formatCurrency(a.facturado)}</td>
                    <td className="py-1.5 pr-4">{formatCurrency(a.gastos)}</td>
                    <td
                      className={`py-1.5 pr-4 font-medium ${
                        a.resultado >= 0 ? "text-accent-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(a.resultado)}
                    </td>
                    <td className="py-1.5 pr-4">{a.margen !== null ? `${a.margen}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Todavía no hay casos cerrados con facturación cargada.</p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Días promedio por etapa</h2>
          {diasPorEtapa.length > 0 ? (
            <div className="space-y-3">
              {diasPorEtapa.map((e) => (
                <div key={e.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700">{e.label}</span>
                    <span className="text-slate-500">
                      {e.promedio ?? 0} días · {e.cantidad} {e.cantidad === 1 ? "caso" : "casos"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-silver-200 overflow-hidden">
                    <div
                      className="h-full bg-accent-600 rounded-full"
                      style={{ width: `${Math.max(Math.round(((e.promedio ?? 0) / maxDias) * 100), 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Todavía no hay eventos completados con fechas cargadas.</p>
          )}
        </section>

        <section className="card p-4">
          <h2 className="font-heading font-semibold text-slate-800 mb-3">Productividad por gestor</h2>
          {rankingGestores.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {rankingGestores.map((g) => (
                <div key={g.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{g.nombre}</p>
                    <p className="text-xs text-slate-500">{g.total} casos asignados</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <span className="badge bg-slate-100 text-slate-600">{g.pendientes.length} pend.</span>
                    {g.cerradosSinPagar.length > 0 && (
                      <span className="badge bg-amber-100 text-amber-800">
                        {g.cerradosSinPagar.length} sin pagar
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Todavía no hay casos con gestor asignado.</p>
          )}
        </section>
      </div>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-slate-800">Cuenta corriente</h2>
          <Link href="/cuenta-corriente" className="text-sm text-brand-600 hover:underline">
            Ver detalle completo →
          </Link>
        </div>
        {cuentaCorriente.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {cuentaCorriente.map((t) => (
              <div key={`${t.tipo}:${t.id}`} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{t.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {t.tipo === "compania" ? "Compañía" : "Desarmadero"} · Facturado{" "}
                    {formatCurrency(t.facturado)}
                  </p>
                </div>
                <span
                  className={`badge shrink-0 ${
                    t.saldo > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {formatCurrency(t.saldo)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hay saldos pendientes en la cuenta corriente.</p>
        )}
      </section>
    </div>
  );
}
