import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { Anticipo, Cobro, EstadoFactura, ESTADOS_FACTURA, NotaCredito } from "@/types/database";
import AnticipoForm from "@/components/cuentaCorriente/AnticipoForm";

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

interface FacturaConDetalle {
  id: string;
  numero_factura: number;
  caso_id: string;
  tipo_receptor: "compania" | "desarmadero";
  receptor_id: string;
  monto_total: number;
  estado: EstadoFactura;
  fecha_emision: string;
  cobros: Cobro[] | null;
  notas_credito: NotaCredito[] | null;
  caso: { numero_siniestro: string; vehiculo: { dominio: string } | null } | null;
  movimientos_caso: { concepto: { nombre: string } | null }[] | null;
}

export default async function CuentaCorrientePage() {
  const usuarioActual = await getUsuarioActual();

  if (usuarioActual?.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">
          Esta sección es solo para el equipo de Oltra.
        </p>
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: facturas, error }, { data: aseguradoras }, { data: desarmaderos }, { data: anticipos }] =
    await Promise.all([
      supabase
        .from("facturas")
        .select(
          "*, cobros(*), notas_credito(*), caso:casos(numero_siniestro, vehiculo:vehiculos(dominio)), movimientos_caso(concepto:conceptos_movimiento(nombre))"
        )
        .order("fecha_emision", { ascending: false }),
      supabase.from("aseguradoras").select("id, nombre"),
      supabase.from("desarmaderos").select("id, nombre"),
      supabase.from("anticipos").select("*")
    ]);

  if (error) {
    return (
      <div className="card p-4 text-sm text-red-600">
        Error al cargar la cuenta corriente: {error.message}
      </div>
    );
  }

  const nombreDe = (tipo: string, id: string) => {
    const lista = tipo === "compania" ? aseguradoras : desarmaderos;
    return lista?.find((x) => x.id === id)?.nombre ?? "—";
  };

  interface Resumen {
    tipo: string;
    id: string;
    nombre: string;
    facturado: number;
    cobrado: number;
    facturas: FacturaConDetalle[];
  }

  const resumenPorTercero = new Map<string, Resumen>();
  for (const f of (facturas as unknown as FacturaConDetalle[] | null) ?? []) {
    const clave = `${f.tipo_receptor}:${f.receptor_id}`;
    if (!resumenPorTercero.has(clave)) {
      resumenPorTercero.set(clave, {
        tipo: f.tipo_receptor,
        id: f.receptor_id,
        nombre: nombreDe(f.tipo_receptor, f.receptor_id),
        facturado: 0,
        cobrado: 0,
        facturas: []
      });
    }
    const entrada = resumenPorTercero.get(clave)!;
    entrada.facturado += Number(f.monto_total);
    entrada.cobrado +=
      (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
      (f.notas_credito ?? []).reduce((acc, n) => acc + Number(n.monto), 0);
    entrada.facturas.push(f);
  }

  const terceros = Array.from(resumenPorTercero.values()).sort(
    (a, b) => b.facturado - b.cobrado - (a.facturado - a.cobrado)
  );

  const anticipoDisponibleDe = (tipo: string, id: string) =>
    ((anticipos as Anticipo[] | null) ?? [])
      .filter((a) => a.tipo_receptor === tipo && a.receptor_id === id)
      .reduce((acc, a) => acc + Number(a.saldo_disponible), 0);

  const serviciosDe = (f: FacturaConDetalle) => {
    const nombres = (f.movimientos_caso ?? [])
      .map((m) => m.concepto?.nombre)
      .filter((n): n is string => !!n);
    return Array.from(new Set(nombres)).join(", ") || "—";
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Cuenta corriente</h1>
      <p className="text-sm text-slate-500 mb-6">
        Saldo pendiente por compañía y desarmadero, sumando todos sus casos.
      </p>

      <div className="space-y-3">
        {terceros.map((t) => {
          const saldo = t.facturado - t.cobrado;
          return (
            <details key={`${t.tipo}:${t.id}`} className="card overflow-hidden">
              <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="font-medium text-slate-800 min-w-[180px]">{t.nombre}</span>
                <span className="text-sm text-slate-500 w-24">
                  {t.tipo === "compania" ? "Compañía" : "Desarmadero"}
                </span>
                <span className="text-sm text-slate-600">
                  Facturado <b className="font-medium">{formatCurrency(t.facturado)}</b>
                </span>
                <span className="text-sm text-slate-600">
                  Cobrado <b className="font-medium">{formatCurrency(t.cobrado)}</b>
                </span>
                <span className="text-sm font-medium text-slate-800">
                  Saldo {formatCurrency(saldo)}
                </span>
                <span className="text-xs text-slate-400 ml-auto">
                  {t.facturas.length} factura{t.facturas.length === 1 ? "" : "s"} — ver detalle
                </span>
              </summary>

              <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                <AnticipoForm
                  tipo={t.tipo as "compania" | "desarmadero"}
                  receptorId={t.id}
                  saldoDisponible={anticipoDisponibleDe(t.tipo, t.id)}
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-1 pr-4 font-medium">N° factura</th>
                        <th className="py-1 pr-4 font-medium">Caso</th>
                        <th className="py-1 pr-4 font-medium">Servicio</th>
                        <th className="py-1 pr-4 font-medium">Fecha</th>
                        <th className="py-1 pr-4 font-medium">Total</th>
                        <th className="py-1 pr-4 font-medium">Cobrado</th>
                        <th className="py-1 pr-4 font-medium">Saldo</th>
                        <th className="py-1 pr-4 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.facturas
                        .sort((a, b) => (a.fecha_emision < b.fecha_emision ? 1 : -1))
                        .map((f) => {
                          const cobradoFactura =
                            (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0) +
                            (f.notas_credito ?? []).reduce((acc, n) => acc + Number(n.monto), 0);
                          return (
                            <tr key={f.id} className="border-t border-slate-100">
                              <td className="py-1.5 pr-4">N° {f.numero_factura}</td>
                              <td className="py-1.5 pr-4">
                                <Link
                                  href={`/casos/${f.caso_id}`}
                                  className="text-brand-600 hover:underline"
                                >
                                  {f.caso?.numero_siniestro ?? "—"}
                                </Link>
                                {f.caso?.vehiculo?.dominio && (
                                  <span className="text-slate-400"> · {f.caso.vehiculo.dominio}</span>
                                )}
                              </td>
                              <td className="py-1.5 pr-4 text-slate-600">{serviciosDe(f)}</td>
                              <td className="py-1.5 pr-4 text-slate-500">
                                {new Date(f.fecha_emision + "T00:00:00").toLocaleDateString("es-AR")}
                              </td>
                              <td className="py-1.5 pr-4">{formatCurrency(f.monto_total)}</td>
                              <td className="py-1.5 pr-4">{formatCurrency(cobradoFactura)}</td>
                              <td className="py-1.5 pr-4">
                                {formatCurrency(f.monto_total - cobradoFactura)}
                              </td>
                              <td className="py-1.5 pr-4">
                                <span className={`badge ${estadoFacturaBadgeClass(f.estado)}`}>
                                  {ESTADOS_FACTURA.find((e) => e.value === f.estado)?.label ?? f.estado}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
        {terceros.length === 0 && (
          <div className="card p-8 text-center text-slate-500">Todavía no hay facturas generadas.</div>
        )}
      </div>
    </div>
  );
}
