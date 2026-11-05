import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import Anexo04Checklist from "@/components/casos/Anexo04Checklist";
import { NOMBRE_IPV, usaAnexo04 } from "@/lib/tipoBaja";

export const dynamic = "force-dynamic";

export default async function CasoAnexo04Page({ params }: { params: { id: string } }) {
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
    .select("id, numero_siniestro, tipo_baja:tipos_baja(nombre)")
    .eq("id", params.id)
    .single();

  if (error || !caso) {
    notFound();
  }

  if (!usaAnexo04((caso.tipo_baja as unknown as { nombre: string } | null)?.nombre)) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">El Anexo 04 no aplica a este caso</h1>
        <p className="text-sm text-slate-500 mb-4">
          En las bajas 04 Digital el {NOMBRE_IPV} ya trae integrada la generación de piezas.
        </p>
        <Link href={`/casos/${caso.id}`} className="btn-secondary">
          ← Volver al caso
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/casos/${caso.id}`} className="text-sm text-brand-600 hover:underline">
          ← Volver al caso
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 mt-1">
          Anexo 04 (Piezas RUDAC) · Siniestro {caso.numero_siniestro}
        </h1>
        <p className="text-sm text-slate-500">
          Piezas autorizadas a desarmar. Se resuelve solo según el tipo de vehículo, y queda
          editable para excepciones puntuales de este caso.
        </p>
      </div>

      <Anexo04Checklist casoId={caso.id} />
    </div>
  );
}
