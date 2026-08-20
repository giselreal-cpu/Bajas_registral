import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CasoConRelaciones } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import CasoCabecera from "@/components/casos/CasoCabecera";
import BitacoraSection from "@/components/casos/BitacoraSection";
import DocumentosSection from "@/components/casos/DocumentosSection";
import HistorialSection from "@/components/casos/HistorialSection";
import { casoEstaSaldado } from "@/lib/estadoFinanciero";
import { ingresosCobradosPorCasos } from "@/lib/rentabilidad";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios(*),
  gestor:gestores(*)
`;

export default async function CasoDetallePage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [
    { data: caso, error },
    { data: aseguradoras },
    { data: desarmaderos },
    { data: registros },
    { data: tiposBaja },
    { data: usuarios },
    { data: gestores }
  ] = await Promise.all([
    supabase.from("casos").select(CASO_SELECT).eq("id", params.id).single(),
    supabase.from("aseguradoras").select("*").order("nombre"),
    supabase.from("desarmaderos").select("*").order("nombre"),
    supabase.from("registros_automotores").select("*").order("numero"),
    supabase.from("tipos_baja").select("*").order("nombre"),
    supabase.from("usuarios").select("*").order("nombre"),
    supabase.from("gestores").select("*").order("nombre")
  ]);

  if (error || !caso) {
    notFound();
  }

  const usuarioActual = await getUsuarioActual();
  const soloLectura = usuarioActual?.rol === "compania";
  const esAdministrador = usuarioActual?.rol === "administrador";
  const casoSaldado = soloLectura ? true : await casoEstaSaldado(params.id);

  let ingresos = 0;
  let egresos = 0;
  if (!soloLectura) {
    const [{ data: movimientos }, cobrado] = await Promise.all([
      supabase
        .from("movimientos_caso")
        .select("monto, concepto:conceptos_movimiento(tipo)")
        .eq("caso_id", params.id),
      ingresosCobradosPorCasos([params.id])
    ]);
    ingresos = cobrado;
    for (const m of (movimientos ?? []) as unknown as { monto: number; concepto: { tipo: string } | null }[]) {
      if (m.concepto?.tipo === "egreso") egresos += Number(m.monto);
    }
  }
  const gananciaNeta = ingresos - egresos;

  return (
    <div className="space-y-6">
      <CasoCabecera
        caso={caso as CasoConRelaciones}
        aseguradoras={aseguradoras ?? []}
        desarmaderos={desarmaderos ?? []}
        registros={registros ?? []}
        tiposBaja={tiposBaja ?? []}
        usuarios={usuarios ?? []}
        gestores={gestores ?? []}
        soloLectura={soloLectura}
        esAdministrador={esAdministrador}
      />

      <section className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-800">Documento generado</h2>
          <p className="text-sm text-slate-500">
            Autorización de retiro y traslado, con los datos del caso ya completados.
          </p>
        </div>
        <a href={`/api/casos/${caso.id}/autorizacion-retiro`} className="btn-secondary">
          Descargar autorización (.docx)
        </a>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BitacoraSection
          casoId={caso.id}
          caso={caso as CasoConRelaciones}
          soloLectura={soloLectura}
          casoSaldado={casoSaldado}
          esAdministrador={esAdministrador}
        />
        <DocumentosSection casoId={caso.id} soloLectura={soloLectura} />
      </div>

      {!soloLectura && (
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="font-medium text-slate-800">Rentabilidad</h2>
            <Link href={`/casos/${caso.id}/rentabilidad`} className="btn-secondary text-xs">
              Ver detalle financiero →
            </Link>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Ingresos = plata efectivamente cobrada, no lo facturado pendiente.
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2">
              <div className="text-xs text-emerald-700">Ingresos</div>
              <div className="font-semibold text-emerald-800">{formatCurrency(ingresos)}</div>
            </div>
            <div className="rounded-md bg-red-50 border border-red-100 p-2">
              <div className="text-xs text-red-700">Egresos</div>
              <div className="font-semibold text-red-800">{formatCurrency(egresos)}</div>
            </div>
            <div
              className={`rounded-md border p-2 ${
                gananciaNeta >= 0 ? "bg-accent-50 border-accent-200" : "bg-red-50 border-red-200"
              }`}
            >
              <div className="text-xs text-slate-600">Ganancia neta</div>
              <div className={`font-semibold ${gananciaNeta >= 0 ? "text-accent-700" : "text-red-800"}`}>
                {formatCurrency(gananciaNeta)}
              </div>
            </div>
          </div>
        </section>
      )}

      <HistorialSection casoId={caso.id} soloLectura={soloLectura} />
    </div>
  );
}
