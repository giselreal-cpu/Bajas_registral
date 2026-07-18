import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CasoConRelaciones, ESTADOS } from "@/types/database";

export const dynamic = "force-dynamic";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  responsable:usuarios(*)
`;

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

export default async function CasosPage({
  searchParams
}: {
  searchParams: { estado?: string; q?: string };
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

  const { data: casos, error } = await query;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Casos</h1>
          <p className="text-sm text-slate-500">
            Bajas registrales por siniestro en curso
          </p>
        </div>
        <Link href="/casos/nuevo" className="btn-primary">
          + Nuevo caso
        </Link>
      </div>

      <form className="card p-4 mb-6 flex flex-wrap gap-3 items-end" method="get">
        <div>
          <label className="label">N° de siniestro</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            className="input"
            placeholder="Buscar..."
          />
        </div>
        <div>
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
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      {error && (
        <div className="card p-4 text-sm text-red-600">
          Error al cargar los casos: {error.message}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">N° siniestro</th>
              <th className="px-4 py-2 font-medium">Asegurado</th>
              <th className="px-4 py-2 font-medium">Dominio</th>
              <th className="px-4 py-2 font-medium">Aseguradora</th>
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
                <td className="px-4 py-2">
                  <Link
                    href={`/casos/${caso.id}`}
                    className="text-brand-600 font-medium hover:underline"
                  >
                    {caso.numero_siniestro}
                  </Link>
                </td>
                <td className="px-4 py-2">{caso.asegurado?.nombre ?? "—"}</td>
                <td className="px-4 py-2 uppercase">
                  {caso.vehiculo?.dominio ?? "—"}
                </td>
                <td className="px-4 py-2">{caso.aseguradora?.nombre ?? "—"}</td>
                <td className="px-4 py-2">{caso.responsable?.nombre ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${estadoBadgeClass(caso.estado)}`}>
                    {ESTADOS.find((e) => e.value === caso.estado)?.label ??
                      caso.estado}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {new Date(caso.fecha_ingreso).toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
            {casos?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
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
