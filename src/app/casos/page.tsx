import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CasoConRelaciones, ESTADOS } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { estadoBadgeClass } from "@/lib/estadoBadge";

export const dynamic = "force-dynamic";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos!inner(*),
  responsable:usuarios(*),
  tipo_baja:tipos_baja(*)
`;

function diasAbiertos(fechaIngreso: string): number {
  const ingreso = new Date(fechaIngreso + "T00:00:00");
  const hoy = new Date();
  return Math.floor((hoy.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function CasosPage({
  searchParams
}: {
  searchParams: {
    estado?: string;
    q?: string;
    dominio?: string;
    aseguradora_id?: string;
    tipo_baja_id?: string;
  };
}) {
  const supabase = createClient();
  let query = supabase
    .from("casos")
    .select(CASO_SELECT)
    .order("created_at", { ascending: false });

  if (searchParams.estado) {
    query = query.eq("estado", searchParams.estado);
  }
  if (searchParams.q) {
    query = query.ilike("numero_siniestro", `%${searchParams.q}%`);
  }
  if (searchParams.dominio) {
    query = query.ilike("vehiculo.dominio", `%${searchParams.dominio}%`);
  }
  if (searchParams.aseguradora_id) {
    query = query.eq("aseguradora_id", searchParams.aseguradora_id);
  }
  if (searchParams.tipo_baja_id) {
    query = query.eq("tipo_baja_id", searchParams.tipo_baja_id);
  }

  const [{ data: casos, error }, { data: aseguradoras }, { data: tiposBaja }] = await Promise.all([
    query,
    supabase.from("aseguradoras").select("id, nombre").order("nombre"),
    supabase.from("tipos_baja").select("id, nombre").order("nombre")
  ]);

  const usuarioActual = await getUsuarioActual();
  const esCompania = usuarioActual?.rol === "compania";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Casos</h1>
          <p className="text-sm text-slate-500">
            Bajas registrales por siniestro en curso
          </p>
        </div>
        {!esCompania && (
          <Link href="/casos/nuevo" className="btn-primary">
            + Nuevo caso
          </Link>
        )}
      </div>

      <form className="card p-4 mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end" method="get">
        <div className="col-span-2 sm:flex-1 sm:min-w-[140px]">
          <label className="label">N° de siniestro</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            className="input"
            placeholder="Buscar..."
          />
        </div>
        <div className="col-span-2 sm:flex-1 sm:min-w-[140px]">
          <label className="label">Dominio</label>
          <input
            name="dominio"
            defaultValue={searchParams.dominio ?? ""}
            className="input uppercase"
            placeholder="Buscar..."
          />
        </div>
        <div className="sm:flex-1 sm:min-w-[160px]">
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
        <div className="sm:flex-1 sm:min-w-[160px]">
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
        <div className="sm:flex-1 sm:min-w-[140px]">
          <label className="label">Estado</label>
          <select
            name="estado"
            defaultValue={searchParams.estado ?? ""}
            className="input"
          >
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary col-span-2 sm:col-span-1" type="submit">
          Filtrar
        </button>
      </form>

      {error && (
        <div className="card p-4 text-sm text-red-600">
          Error al cargar los casos: {error.message}
        </div>
      )}

      {/* Mobile: cards */}
      <div className="mv md:hidden -mx-4 px-4 pb-4" style={{ background: "var(--mv-bg)" }}>
        <div className="pt-1 pb-3">
          <h2 className="mv-heading text-base">Casos</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-600)" }}>
            {casos?.length ?? 0} {casos?.length === 1 ? "caso" : "casos"}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {(casos as CasoConRelaciones[] | null)?.map((caso) => {
            const abierto = caso.estado !== "cerrado";
            const dias = diasAbiertos(caso.fecha_ingreso);
            return (
              <Link key={caso.id} href={`/casos/${caso.id}`} className="mv-card block p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className="uppercase leading-tight"
                      style={{
                        fontFamily: "var(--mv-font-body)",
                        fontWeight: 600,
                        fontSize: 21,
                        letterSpacing: "0.01em",
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      {caso.vehiculo?.dominio ?? "—"}
                    </div>
                    <div className="text-[12.5px] mt-0.5 truncate" style={{ color: "var(--mv-neutral-700)" }}>
                      {[caso.vehiculo?.marca, caso.vehiculo?.modelo].filter(Boolean).join(" ") || "—"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="uppercase tracking-wide tabular-nums text-[11px]"
                      style={{ color: "var(--mv-neutral-600)", letterSpacing: "0.08em" }}
                    >
                      {caso.numero_caso === 0 ? "DEMO" : `N° ${caso.numero_caso}`}
                    </div>
                    <div className="text-xs tabular-nums mt-0.5" style={{ color: "var(--mv-neutral-700)" }}>
                      {caso.numero_siniestro}
                    </div>
                  </div>
                </div>
                <div className="h-px my-2.5" style={{ background: "var(--mv-divider)" }} />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[12.5px] truncate" style={{ color: "var(--mv-neutral-800)" }}>
                    {caso.asegurado?.nombre ?? "—"} · {caso.aseguradora?.nombre ?? "—"}
                  </div>
                  {abierto && dias >= 15 && (
                    <span
                      className="shrink-0 text-[11px] tabular-nums"
                      style={{
                        color: "var(--mv-accent-700)",
                        borderBottom: "1px solid var(--mv-accent)",
                        paddingBottom: 1
                      }}
                    >
                      {dias} días abierto
                    </span>
                  )}
                </div>
                <div className="mt-2.5">
                  <span className={`mv-badge ${abierto ? "" : "mv-badge-closed"}`}>
                    {ESTADOS.find((e) => e.value === caso.estado)?.label ?? caso.estado}
                  </span>
                </div>
              </Link>
            );
          })}
          {casos?.length === 0 && (
            <div className="mv-card p-8 text-center text-sm" style={{ color: "var(--mv-neutral-600)" }}>
              No hay casos cargados todavía.
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">N°</th>
              <th className="px-4 py-2 font-medium">N° siniestro</th>
              <th className="px-4 py-2 font-medium">Asegurado</th>
              <th className="px-4 py-2 font-medium">Dominio</th>
              <th className="px-4 py-2 font-medium">Aseguradora</th>
              <th className="px-4 py-2 font-medium">Tipo de baja</th>
              <th className="px-4 py-2 font-medium">Responsable</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Ingreso</th>
            </tr>
          </thead>
          <tbody>
            {(casos as CasoConRelaciones[] | null)?.map((caso) => (
              <tr
                key={caso.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-2 text-slate-500">
                  {caso.numero_caso === 0 ? (
                    <span className="badge bg-slate-100 text-slate-400">DEMO</span>
                  ) : (
                    caso.numero_caso
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/casos/${caso.id}`}
                    className="text-brand-600 font-medium hover:underline"
                  >
                    {caso.numero_siniestro}
                  </Link>
                </td>
                <td className="px-4 py-2">{caso.asegurado?.nombre ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className="uppercase">{caso.vehiculo?.dominio ?? "—"}</span>
                  {(caso.vehiculo?.marca || caso.vehiculo?.modelo) && (
                    <span className="text-slate-400">
                      {" · "}
                      {[caso.vehiculo?.marca, caso.vehiculo?.modelo].filter(Boolean).join(" ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{caso.aseguradora?.nombre ?? "—"}</td>
                <td className="px-4 py-2">{caso.tipo_baja?.nombre ?? "—"}</td>
                <td className="px-4 py-2">{caso.responsable?.nombre ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${estadoBadgeClass(caso.estado)}`}>
                    {ESTADOS.find((e) => e.value === caso.estado)?.label ??
                      caso.estado}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {new Date(caso.fecha_ingreso + "T00:00:00").toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
            {casos?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No hay casos cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
