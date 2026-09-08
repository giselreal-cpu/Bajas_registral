import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import AprobarGastoButton from "@/components/caja/AprobarGastoButton";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

interface FacturaOutstanding {
  id: string;
  caso_id: string;
  tipo_receptor: string;
  receptor_id: string;
  monto_total: number;
  cobros: { monto: number }[];
  notas_credito: { monto: number }[];
}

export default async function CajaPage() {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return (
      <div className="mv max-w-md mx-auto text-center py-16">
        <h1 className="mv-heading text-lg mb-2">Sin acceso</h1>
        <p className="text-sm" style={{ color: "var(--mv-neutral-600)" }}>
          Esta sección es información financiera interna.
        </p>
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: facturasRaw }, { data: gastosPendientesRaw }, { data: aseguradoras }] =
    await Promise.all([
      supabase
        .from("facturas")
        .select("id, caso_id, tipo_receptor, receptor_id, monto_total, cobros(monto), notas_credito(monto)")
        .eq("tipo_receptor", "compania")
        .neq("estado", "cobrado_total"),
      supabase
        .from("movimientos_caso")
        .select(
          "*, concepto:conceptos_movimiento(*), caso:casos(numero_siniestro, vehiculo:vehiculos(dominio)), creado_por_usuario:usuarios(nombre), documento:documentos(id, url)"
        )
        .eq("aprobado", false)
        .order("created_at", { ascending: false }),
      supabase.from("aseguradoras").select("id, nombre").order("nombre")
    ]);

  const facturas = (facturasRaw ?? []) as unknown as FacturaOutstanding[];
  const saldoDe = (f: FacturaOutstanding) =>
    f.monto_total -
    f.cobros.reduce((a, c) => a + c.monto, 0) -
    f.notas_credito.reduce((a, n) => a + n.monto, 0);

  const totalACobrar = facturas.reduce((a, f) => a + Math.max(saldoDe(f), 0), 0);
  const casosFacturados = new Set(facturas.map((f) => f.caso_id)).size;

  const cobranzasPorCompania = (aseguradoras ?? [])
    .map((a) => {
      const propias = facturas.filter((f) => f.receptor_id === a.id);
      const monto = propias.reduce((acc, f) => acc + Math.max(saldoDe(f), 0), 0);
      return { nombre: a.nombre, monto, detalle: `${propias.length} factura${propias.length === 1 ? "" : "s"} pendiente${propias.length === 1 ? "" : "s"}` };
    })
    .filter((c) => c.monto > 0)
    .sort((a, b) => b.monto - a.monto);

  interface GastoPendiente {
    id: string;
    monto: number;
    caja_id: string | null;
    concepto: { nombre: string } | null;
    caso: { numero_siniestro: string; vehiculo: { dominio: string } | null } | null;
    creado_por_usuario: { nombre: string } | null;
    documento: { id: string; url: string } | null;
  }

  const gastosPendientes = (gastosPendientesRaw ?? []) as unknown as GastoPendiente[];
  const totalARendir = gastosPendientes.reduce((a, g) => a + g.monto, 0);

  const gastosConComprobante = await Promise.all(
    gastosPendientes.map(async (g) => ({
      ...g,
      comprobante_url: g.documento ? await obtenerUrlFirmada(g.documento.url) : null
    }))
  );

  return (
    <div className="mv -mx-4 px-4 pb-6" style={{ background: "var(--mv-bg)" }}>
      <div className="pt-1 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="mv-heading text-lg">Caja</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-600)" }}>
            Gastos y cobranzas por caso
          </p>
        </div>
        <Link
          href="/caja/nuevo"
          className="mv-btn mv-btn-primary text-xs px-3.5 py-2 shrink-0"
        >
          + Registrar gasto
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="mv-card p-3.5">
          <div className="mv-label">A cobrar</div>
          <div className="mv-heading text-2xl mt-1.5 tabular-nums">{formatCurrency(totalACobrar)}</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--mv-neutral-600)" }}>
            {casosFacturados} {casosFacturados === 1 ? "caso facturado" : "casos facturados"}
          </div>
        </div>
        <div className="mv-card p-3.5">
          <div className="mv-label">A rendir</div>
          <div
            className="mv-heading text-2xl mt-1.5 tabular-nums"
            style={{ color: "var(--mv-accent-700)" }}
          >
            {formatCurrency(totalARendir)}
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--mv-neutral-600)" }}>
            {gastosPendientes.length} {gastosPendientes.length === 1 ? "gasto de campo" : "gastos de campo"}
          </div>
        </div>
      </div>

      <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
      <h5 className="text-[15px] mb-2.5" style={{ letterSpacing: "-0.01em" }}>
        Rendiciones pendientes
      </h5>
      <div className="flex flex-col gap-3">
        {gastosConComprobante.map((g) => (
          <div key={g.id} className="mv-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mv-heading text-[15px]">{g.concepto?.nombre ?? "—"}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-700)" }}>
                  {g.caso?.vehiculo?.dominio ?? g.caso?.numero_siniestro ?? "—"} ·{" "}
                  {g.creado_por_usuario?.nombre ?? "—"}
                </div>
              </div>
              <div className="mv-heading text-[19px] tabular-nums shrink-0">
                {formatCurrency(g.monto)}
              </div>
            </div>
            <div className="h-px my-3" style={{ background: "var(--mv-divider)" }} />
            <div className="flex items-center gap-2.5">
              <AprobarGastoButton movimientoId={g.id} esAdministrador={usuarioActual?.rol === "administrador"} />
              {g.comprobante_url && (
                <a
                  href={g.comprobante_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs shrink-0"
                  style={{ color: "var(--mv-neutral-600)" }}
                >
                  Ver comprobante
                </a>
              )}
            </div>
          </div>
        ))}
        {gastosConComprobante.length === 0 && (
          <div className="mv-card p-6 text-center text-sm" style={{ color: "var(--mv-neutral-600)" }}>
            No hay rendiciones pendientes.
          </div>
        )}
      </div>

      <div className="h-px my-5" style={{ background: "var(--mv-divider)" }} />
      <h5 className="text-[15px] mb-2.5" style={{ letterSpacing: "-0.01em" }}>
        Cobranzas por compañía
      </h5>
      <div className="mv-card px-3.5">
        {cobranzasPorCompania.map((c, i) => (
          <div
            key={c.nombre}
            className="flex items-center justify-between gap-3 py-3"
            style={i < cobranzasPorCompania.length - 1 ? { borderBottom: "1px solid var(--mv-divider)" } : undefined}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] truncate">{c.nombre}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--mv-neutral-600)" }}>
                {c.detalle}
              </div>
            </div>
            <div className="mv-heading text-sm tabular-nums shrink-0">{formatCurrency(c.monto)}</div>
          </div>
        ))}
        {cobranzasPorCompania.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: "var(--mv-neutral-600)" }}>
            No hay cobranzas pendientes.
          </p>
        )}
      </div>
      <p className="text-[11.5px] mt-3.5" style={{ color: "var(--mv-neutral-600)" }}>
        La facturación y el cierre contable se hacen en escritorio, en Administración. Acá solo
        entra lo que se origina en la calle.
      </p>
    </div>
  );
}
