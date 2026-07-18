import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CasoConRelaciones } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import CasoCabecera from "@/components/casos/CasoCabecera";
import BitacoraSection from "@/components/casos/BitacoraSection";
import DocumentosSection from "@/components/casos/DocumentosSection";

export const dynamic = "force-dynamic";

const CASO_SELECT = `
  *,
  aseguradora:aseguradoras(*),
  asegurado:asegurados(*),
  vehiculo:vehiculos(*),
  desarmadero:desarmaderos(*),
  registro:registros_automotores(*),
  tipo_baja:tipos_baja(*),
  responsable:usuarios(*)
`;

export default async function CasoDetallePage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [{ data: caso, error }, { data: desarmaderos }, { data: registros }, { data: tiposBaja }, { data: usuarios }] =
    await Promise.all([
      supabase.from("casos").select(CASO_SELECT).eq("id", params.id).single(),
      supabase.from("desarmaderos").select("*").order("nombre"),
      supabase.from("registros_automotores").select("*").order("numero"),
      supabase.from("tipos_baja").select("*").order("nombre"),
      supabase.from("usuarios").select("*").order("nombre")
    ]);

  if (error || !caso) {
    notFound();
  }

  const usuarioActual = await getUsuarioActual();
  const soloLectura = usuarioActual?.rol === "compania";
  const esAdministrador = usuarioActual?.rol === "administrador";

  return (
    <div className="space-y-6">
      <CasoCabecera
        caso={caso as CasoConRelaciones}
        desarmaderos={desarmaderos ?? []}
        registros={registros ?? []}
        tiposBaja={tiposBaja ?? []}
        usuarios={usuarios ?? []}
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
        <BitacoraSection casoId={caso.id} soloLectura={soloLectura} />
        <DocumentosSection casoId={caso.id} soloLectura={soloLectura} />
      </div>
    </div>
  );
}
