import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { EstadoFactura, ESTADOS_FACTURA } from "@/types/database";
import MovimientoPagadoToggle from "@/components/casos/MovimientoPagadoToggle";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function estadoFacturaBadgeClass(estado: string) {
  switch (estado) {
    case "cobrado_total":
      return "bg-emerald-100 text-emerald-700";
    case "cobrado_parcial":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

interface CasoReporte {
  id: string;
  numero_siniestro: string;
  aseguradora: { nombre: string } | null;
  desarmadero: { nombre: string } | null;
  vehiculo: { dominio: string } | null;
  movimientos_caso: {
    id: string;
    monto: number;
    fecha: string;
    observacion: string | null;
    pagado: boolean;
    concepto: { nombre: string; tipo: string } | null;
  }[];
  facturas: {
    id: string;
    numero_factura: number;
    tipo_receptor: "compania" | "desarmadero";
    monto_total: number;
    estado: EstadoFactura;
    fecha_emision: string;
    cobros: { monto: number }[];
    notas_credito: { monto: number }[];
  }[];
}

export default async function SeguimientoFinancieroPage() {
  const usuarioActual = await getUsuarioActual();

  if (usuarioActual?.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">Esta sección es solo para el equipo de Oltra.</p>
      </div>
    );
  }

  const supabase = createClient();

  const { data: casos, error } = await supabase
    .from("casos")
    .select(
      `
      id, numero_siniestro,
      aseguradora:aseguradoras(nombre),
      desarmadero:desarmaderos(nombre),
      vehiculo:vehiculos(dominio),
      movimientos_caso(id, monto, fecha, observacion, pagado, concepto:conceptos_movimiento(nombre, tipo)),
      facturas(id, numero_factura, tipo_receptor, monto_total, estado, fecha_emision, cobros(monto), notas_credito(monto))
    `
    )
    .order("numero_caso", { ascending: false });

  if (error) {
    return (
      <div className="card p-4 text-sm text-red-600">
        Error al cargar el seguimiento financiero: {error.message}
      </div>
    );
  }

  const casosConActividad = ((casos as unknown as CasoReporte[]) ?? [])
    .map((c) => {
      const egresos = c.movimientos_caso.filter((m) => m.concepto?.tipo === "egreso");
      const egresosPendientes = egresos.filter((m) => !m.pagado);
      const egresosPagados = egresos.filter((m) => m.pagado);
      const totalPendientePago = egresosPendientes.reduce((acc, m) => acc + Number(m.monto), 0);
      const totalPagado = egresosPagados.reduce((acc, m) => acc + Number(m.monto), 0);

      const facturasConSaldo = c.facturas.map((f) => {
        const cobrado =
          f.cobros.reduce((acc, cob) => acc + Number(cob.monto), 0) +
          f.notas_credito.reduce((acc, n) => acc + Number(n.monto), 0);
        return { ...f, cobrado, saldo: Number(f.monto_total) - cobrado };
      });
      const totalPendienteCobro = facturasConSaldo.reduce((acc, f) => acc + f.saldo, 0);

      return {
        ...c,
        egresos,
        totalPendientePago,
        totalPagado,
        facturasConSaldo,
        totalPendienteCobro
      };
    })
    .filter((c) => c.movimientos_caso.length > 0 || c.facturas.length > 0)
    .sort(
      (a, b) =>
        b.totalPendienteCobro + b.totalPendientePago - (a.totalPendienteCobro + a.totalPendientePago)
    );

  const totalGeneralPendienteCobro = casosConActividad.reduce((acc, c) => acc + c.totalPendienteCobro, 0);
  const totalGeneralPendientePago = casosConActividad.reduce((acc, c) => acc + c.totalPendientePago, 0);
  const totalGeneralPagado = casosConActividad.reduce((acc, c) => acc + c.totalPagado, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Seguimiento financiero</h1>
      <p className="text-sm text-slate-500 mb-6">
        Por cada caso con movimientos cargados: lo que falta cobrar (facturas sin saldar) y los
        egresos cargados, marcando cuáles ya se pagaron y cuáles siguen pendientes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 bg-emerald-50 border-emerald-100">
          <div className="text-xs text-emerald-700">Pendiente por cobrar</div>
          <div className="text-xl font-semibold text-emerald-800">
            {formatCurrency(totalGeneralPendienteCobro)}
          </div>
        </div>
        <div className="card p-4 bg-red-50 border-red-100">
          <div className="text-xs text-red-700">Pendiente por pagar</div>
          <div className="text-xl font-semibold text-red-800">
            {formatCurrency(totalGeneralPendientePago)}
          </div>
        </div>
        <div className="card p-4 bg-slate-50 border-slate-200">
          <div className="text-xs text-slate-500">Ya pagado</div>
          <div className="text-xl font-semibold text-slate-700">
            {formatCurrency(totalGeneralPagado)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {casosConActividad.map((c) => (
          <details key={c.id} className="card overflow-hidden">
            <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href={`/casos/${c.id}`}
                className="font-medium text-brand-600 hover:underline min-w-[140px]"
              >
                {c.numero_siniestro}
              </Link>
              <span className="text-sm text-slate-500">
                {c.aseguradora?.nombre ?? "—"}
                {c.vehiculo?.dominio && ` · ${c.vehiculo.dominio}`}
              </span>
              {c.totalPendienteCobro > 0 && (
                <span className="text-sm text-emerald-700">
                  Pendiente de cobro <b className="font-medium">{formatCurrency(c.totalPendienteCobro)}</b>
                </span>
              )}
              {c.totalPendientePago > 0 && (
                <span className="text-sm text-red-700">
                  Pendiente de pago <b className="font-medium">{formatCurrency(c.totalPendientePago)}</b>
                </span>
              )}
              <span className="text-xs text-slate-400 ml-auto">ver detalle</span>
            </summary>

            <div className="border-t border-slate-100 px-4 py-3 space-y-4">
              {c.facturasConSaldo.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Facturas (pendiente de cobro)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="py-1 pr-4 font-medium">N°</th>
                          <th className="py-1 pr-4 font-medium">Receptor</th>
                          <th className="py-1 pr-4 font-medium">Fecha</th>
                          <th className="py-1 pr-4 font-medium">Total</th>
                          <th className="py-1 pr-4 font-medium">Cobrado</th>
                          <th className="py-1 pr-4 font-medium">Saldo</th>
                          <th className="py-1 pr-4 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.facturasConSaldo.map((f) => (
                          <tr key={f.id} className="border-t border-slate-100">
                            <td className="py-1.5 pr-4">N° {f.numero_factura}</td>
                            <td className="py-1.5 pr-4">
                              {f.tipo_receptor === "compania"
                                ? c.aseguradora?.nombre ?? "Compañía"
                                : c.desarmadero?.nombre ?? "Desarmadero"}
                            </td>
                            <td className="py-1.5 pr-4 text-slate-500">
                              {new Date(f.fecha_emision + "T00:00:00").toLocaleDateString("es-AR")}
                            </td>
                            <td className="py-1.5 pr-4">{formatCurrency(f.monto_total)}</td>
                            <td className="py-1.5 pr-4">{formatCurrency(f.cobrado)}</td>
                            <td className="py-1.5 pr-4 font-medium">{formatCurrency(f.saldo)}</td>
                            <td className="py-1.5 pr-4">
                              <span className={`badge ${estadoFacturaBadgeClass(f.estado)}`}>
                                {ESTADOS_FACTURA.find((e) => e.value === f.estado)?.label ?? f.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {c.egresos.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Egresos cargados
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="py-1 pr-4 font-medium">Concepto</th>
                          <th className="py-1 pr-4 font-medium">Fecha</th>
                          <th className="py-1 pr-4 font-medium">Monto</th>
                          <th className="py-1 pr-4 font-medium">Observación</th>
                          <th className="py-1 pr-4 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.egresos.map((m) => (
                          <tr key={m.id} className="border-t border-slate-100">
                            <td className="py-1.5 pr-4">{m.concepto?.nombre ?? "—"}</td>
                            <td className="py-1.5 pr-4 text-slate-500">
                              {new Date(m.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                            </td>
                            <td className="py-1.5 pr-4 font-medium">{formatCurrency(m.monto)}</td>
                            <td className="py-1.5 pr-4 text-slate-500">{m.observacion || "—"}</td>
                            <td className="py-1.5 pr-4">
                              <MovimientoPagadoToggle movimientoId={m.id} pagado={m.pagado} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </details>
        ))}
        {casosConActividad.length === 0 && (
          <div className="card p-8 text-center text-slate-500">
            Todavía no hay casos con movimientos o facturas cargadas.
          </div>
        )}
      </div>
    </div>
  );
}
