import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CasoConRelaciones } from "@/types/database";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import RentabilidadSection from "@/components/casos/RentabilidadSection";

export const dynamic = "force-dynamic";

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

export default async function CasoRentabilidadPage({
  params
}: {
  params: { id: string };
}) {
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
  const { data: caso, error } = await supabase
    .from("casos")
    .select(CASO_SELECT)
    .eq("id", params.id)
    .single();

  if (error || !caso) {
    notFound();
  }

  const casoTipado = caso as unknown as CasoConRelaciones;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/casos/${casoTipado.id}`} className="text-sm text-brand-600 hover:underline">
          ← Volver al caso
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 mt-1">
          Rentabilidad · Siniestro {casoTipado.numero_siniestro}
        </h1>
        <p className="text-sm text-slate-500">
          {casoTipado.asegurado?.nombre} · {casoTipado.aseguradora?.nombre}
        </p>
      </div>

      <RentabilidadSection casoId={casoTipado.id} caso={casoTipado} />
    </div>
  );
}
