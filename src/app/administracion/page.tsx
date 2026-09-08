import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import MovimientosGeneralesSection from "@/components/administracion/MovimientosGeneralesSection";
import LibroImportSection from "@/components/administracion/LibroImportSection";
import { obtenerFilasLibro } from "@/lib/libroMovimientos";

export const dynamic = "force-dynamic";

function formatCurrency(value: number, moneda: "ARS" | "USD" = "ARS"): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: moneda });
}

interface SearchParams {
  reporte?: string;
  caja_id?: string;
  cuenta_contable_id?: string;
  aseguradora_id?: string;
  desde?: string;
  hasta?: string;
}

export default async function AdministracionPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
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
  const reporte =
    searchParams.reporte === "liquidez"
      ? "liquidez"
      : searchParams.reporte === "generales"
        ? "generales"
        : "libro";

  const [{ data: cajas }, { data: cuentas }, { data: aseguradoras }] = await Promise.all([
    supabase.from("cajas").select("*").eq("activa", true).order("nombre"),
    supabase
      .from("cuentas_contables")
      .select("*")
      .eq("imputable", true)
      .in("tipo", ["ingreso", "egreso"])
      .order("codigo"),
    supabase.from("aseguradoras").select("id, nombre").order("nombre")
  ]);

  // El Libro de movimientos es un libro de CAJA (plata que efectivamente
  // entró o salió), no de lo devengado — ver src/lib/libroMovimientos.ts
  // (compartido con la exportación a CSV en /api/administracion/libro-export).
  const { filasUnificadas, filas, entradas, salidas } = await obtenerFilasLibro(searchParams);

  // Liquidez: mismo criterio de caja del Libro (egresos pagados +
  // cobros reales, no lo devengado), agrupado por caja, sin el filtro
  // de caja puntual (para poder listar todas las tarjetas) pero
  // respetando el resto de los filtros (fecha) — sin el filtro de
  // centro de costo, que es propio del Libro.
  let queryLiquidez = supabase
    .from("movimientos_caso")
    .select("caja_id, monto, concepto:conceptos_movimiento(tipo)")
    .eq("aprobado", true)
    .eq("pagado", true)
    .not("caja_id", "is", null);
  if (searchParams.desde) queryLiquidez = queryLiquidez.gte("fecha", searchParams.desde);
  if (searchParams.hasta) queryLiquidez = queryLiquidez.lte("fecha", searchParams.hasta);
  let queryCobrosLiquidez = supabase.from("cobros").select("caja_id, monto").not("caja_id", "is", null);
  if (searchParams.desde) queryCobrosLiquidez = queryCobrosLiquidez.gte("fecha", searchParams.desde);
  if (searchParams.hasta) queryCobrosLiquidez = queryCobrosLiquidez.lte("fecha", searchParams.hasta);
  let queryAnticiposLiquidez = supabase.from("anticipos").select("caja_id, monto").not("caja_id", "is", null);
  if (searchParams.desde) queryAnticiposLiquidez = queryAnticiposLiquidez.gte("fecha", searchParams.desde);
  if (searchParams.hasta) queryAnticiposLiquidez = queryAnticiposLiquidez.lte("fecha", searchParams.hasta);
  let queryLiquidezGenerales = supabase
    .from("movimientos_generales")
    .select("caja_id, monto, tipo")
    .not("caja_id", "is", null);
  if (searchParams.desde) queryLiquidezGenerales = queryLiquidezGenerales.gte("fecha", searchParams.desde);
  if (searchParams.hasta) queryLiquidezGenerales = queryLiquidezGenerales.lte("fecha", searchParams.hasta);
  const [
    { data: movsLiquidezRaw },
    { data: cobrosLiquidezRaw },
    { data: anticiposLiquidezRaw },
    { data: generalesLiquidezRaw }
  ] = await Promise.all([
    queryLiquidez,
    queryCobrosLiquidez,
    queryAnticiposLiquidez,
    queryLiquidezGenerales
  ]);
  const movsLiquidez = [
    ...((movsLiquidezRaw ?? []) as unknown as {
      caja_id: string;
      monto: number;
      concepto: { tipo: string } | null;
    }[]).filter((m) => m.concepto?.tipo === "egreso"),
    ...((cobrosLiquidezRaw ?? []) as unknown as { caja_id: string; monto: number }[]).map((c) => ({
      caja_id: c.caja_id,
      monto: c.monto,
      concepto: { tipo: "ingreso" }
    })),
    ...((anticiposLiquidezRaw ?? []) as unknown as { caja_id: string; monto: number }[]).map((a) => ({
      caja_id: a.caja_id,
      monto: a.monto,
      concepto: { tipo: "ingreso" }
    })),
    ...((generalesLiquidezRaw ?? []) as unknown as { caja_id: string; monto: number; tipo: string }[]).map(
      (m) => ({ caja_id: m.caja_id, monto: m.monto, concepto: { tipo: m.tipo } })
    )
  ];

  const sinCaja = filasUnificadas.filter((f) => !f.cajaNombre);
  const netoSinCaja = sinCaja.reduce((a, f) => a + (f.tipo === "egreso" ? -f.monto : f.monto), 0);

  const cajasVista = searchParams.caja_id
    ? (cajas ?? []).filter((c) => c.id === searchParams.caja_id)
    : cajas ?? [];

  const tarjetasLiquidez = cajasVista.map((caja) => {
    const propios = movsLiquidez.filter((m) => m.caja_id === caja.id);
    const entradasCaja = propios
      .filter((m) => m.concepto?.tipo === "ingreso")
      .reduce((a, m) => a + m.monto, 0);
    const salidasCaja = propios
      .filter((m) => m.concepto?.tipo === "egreso")
      .reduce((a, m) => a + m.monto, 0);
    const saldoCaja = caja.saldo_inicial + entradasCaja - salidasCaja;
    return { caja, entradasCaja, salidasCaja, saldoCaja };
  });

  // Nunca se suma en un solo total cajas de distinta moneda (ARS + USD
  // como si fueran lo mismo sería un número sin sentido) — se agrupa por
  // moneda, cada una con su propio total disponible.
  const disponiblePorMoneda = new Map<string, number>();
  for (const t of tarjetasLiquidez) {
    disponiblePorMoneda.set(
      t.caja.moneda,
      (disponiblePorMoneda.get(t.caja.moneda) ?? 0) + t.saldoCaja
    );
  }

  function qs(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const combinado = { ...searchParams, ...overrides };
    Object.entries(combinado).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return `/administracion?${params.toString()}`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Administración</h1>
          <p className="text-sm text-slate-500">
            Libro de movimientos y liquidez por caja — solo lo efectivamente pagado o cobrado
            (no lo devengado), uniendo egresos pagados y cobros por caso con los movimientos
            generales (sueldos, hosting, alquiler, etc.) que no son de un caso puntual.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Link
          href={qs({ reporte: "libro" })}
          className={`btn-secondary ${reporte === "libro" ? "!bg-brand-900 !text-white" : ""}`}
        >
          Libro de movimientos
        </Link>
        <Link
          href={qs({ reporte: "liquidez" })}
          className={`btn-secondary ${reporte === "liquidez" ? "!bg-brand-900 !text-white" : ""}`}
        >
          Liquidez
        </Link>
        <Link
          href={qs({ reporte: "generales" })}
          className={`btn-secondary ${reporte === "generales" ? "!bg-brand-900 !text-white" : ""}`}
        >
          Movimientos generales
        </Link>
      </div>

      {reporte !== "generales" && (
      <form className="card p-4 mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end" method="get">
        <input type="hidden" name="reporte" value={reporte} />
        <div className="sm:flex-1 sm:min-w-[130px]">
          <label className="label">Desde</label>
          <input type="date" name="desde" defaultValue={searchParams.desde ?? ""} className="input" />
        </div>
        <div className="sm:flex-1 sm:min-w-[130px]">
          <label className="label">Hasta</label>
          <input type="date" name="hasta" defaultValue={searchParams.hasta ?? ""} className="input" />
        </div>
        <div className="sm:flex-1 sm:min-w-[160px]">
          <label className="label">Caja</label>
          <select name="caja_id" defaultValue={searchParams.caja_id ?? ""} className="input">
            <option value="">Todas las cajas</option>
            {cajas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {reporte === "libro" && (
          <>
            <div className="sm:flex-1 sm:min-w-[160px]">
              <label className="label">Cuenta contable</label>
              <select
                name="cuenta_contable_id"
                defaultValue={searchParams.cuenta_contable_id ?? ""}
                className="input"
              >
                <option value="">Todas las cuentas</option>
                {cuentas?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:flex-1 sm:min-w-[160px]">
              <label className="label">Centro de costo (compañía)</label>
              <select
                name="aseguradora_id"
                defaultValue={searchParams.aseguradora_id ?? ""}
                className="input"
              >
                <option value="">Todos los centros</option>
                {aseguradoras?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <button className="btn-secondary col-span-2 sm:col-span-1" type="submit">
          Filtrar
        </button>
      </form>
      )}

      {reporte === "generales" ? (
        <MovimientosGeneralesSection cajas={cajas ?? []} cuentas={cuentas ?? []} />
      ) : reporte === "libro" ? (
        <>
          <LibroImportSection />
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs text-slate-500">
              {filas.length === 1 ? "1 movimiento" : `${filas.length} movimientos`}
            </span>
            <a
              href={`/api/administracion/libro-export?${new URLSearchParams(
                Object.entries(searchParams).filter(([k, v]) => k !== "reporte" && !!v) as [string, string][]
              ).toString()}`}
              className="btn-secondary text-xs shrink-0"
            >
              Exportar CSV
            </a>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Solo egresos ya pagados y cobros ya recibidos, con caja o cuenta asignada — lo
            pendiente de pago/cobro o sin caja/cuenta asignada se sigue viendo en la ficha del
            caso.
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Caso</th>
                  <th className="px-4 py-2 font-medium">Descripción</th>
                  <th className="px-4 py-2 font-medium">Cuenta</th>
                  <th className="px-4 py-2 font-medium">Caja</th>
                  <th className="px-4 py-2 font-medium">C. de costo</th>
                  <th className="px-4 py-2 font-medium text-right">Importe</th>
                  <th className="px-4 py-2 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ f, importe, saldo: saldoFila }) => (
                  <tr key={f.key} className="border-t border-slate-100">
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                      {new Date(f.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {f.casoHref ? (
                        <Link href={f.casoHref} className="text-brand-600 hover:underline">
                          {f.casoLabel}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">{f.descripcion}</td>
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {f.cuentaCodigo ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{f.cajaNombre ?? "Sin asignar"}</td>
                    <td className="px-4 py-2 text-slate-500">{f.centroDeCosto}</td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${
                        importe < 0 ? "text-red-700" : "text-slate-800"
                      }`}
                    >
                      {formatCurrency(importe)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {formatCurrency(saldoFila)}
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No hay movimientos con caja o cuenta asignada para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-8 mt-4 pt-3 border-t border-slate-100 text-right">
            <div>
              <div className="label">Entradas</div>
              <div className="font-semibold text-slate-800">{formatCurrency(entradas)}</div>
            </div>
            <div>
              <div className="label">Salidas</div>
              <div className="font-semibold text-red-700">− {formatCurrency(salidas)}</div>
            </div>
            <div>
              <div className="label">Neto</div>
              <div className="font-semibold text-slate-800">{formatCurrency(entradas - salidas)}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tarjetasLiquidez.map(({ caja, entradasCaja, salidasCaja, saldoCaja }) => (
              <div key={caja.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-heading font-semibold">{caja.nombre}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {caja.tipo} · {caja.moneda}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="label">Saldo actual</div>
                    <div className="font-heading font-semibold text-lg mt-1">
                      {formatCurrency(saldoCaja, caja.moneda)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between gap-4 mt-4 pt-3 border-t border-slate-100 text-sm">
                  <div>
                    <div className="label">Entradas</div>
                    <div className="mt-0.5">{formatCurrency(entradasCaja, caja.moneda)}</div>
                  </div>
                  <div>
                    <div className="label">Salidas</div>
                    <div className="mt-0.5">{formatCurrency(salidasCaja, caja.moneda)}</div>
                  </div>
                  <div className="text-right">
                    <div className="label">Neto del período</div>
                    <div className="mt-0.5">
                      {formatCurrency(entradasCaja - salidasCaja, caja.moneda)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {tarjetasLiquidez.length === 0 && (
              <div className="card p-8 text-center text-slate-500 sm:col-span-2">
                No hay cajas activas cargadas todavía — sumalas en Catálogos → Cajas.
              </div>
            )}
          </div>
          <div className="flex items-baseline justify-between mt-6 pt-4 border-t border-slate-100">
            <div>
              <div className="label">
                {searchParams.caja_id ? "Disponible en esta caja" : "Disponible total"}
              </div>
              <div className="flex gap-4 mt-1">
                {Array.from(disponiblePorMoneda.entries()).map(([moneda, total]) => (
                  <div key={moneda} className="font-heading font-semibold text-2xl">
                    {formatCurrency(total, moneda as "ARS" | "USD")}
                  </div>
                ))}
                {disponiblePorMoneda.size === 0 && (
                  <div className="font-heading font-semibold text-2xl">{formatCurrency(0)}</div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-md text-right">
              {sinCaja.length === 0
                ? "No hay movimientos sin caja asignada en este período."
                : `Además hay ${formatCurrency(Math.abs(netoSinCaja))} en ${sinCaja.length === 1 ? "1 movimiento" : `${sinCaja.length} movimientos`} sin caja asignada — quedan fuera de estas tarjetas.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
