import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import Anexo04Checklist from "@/components/casos/Anexo04Checklist";

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
    .select("id, numero_siniestro")
    .eq("id", params.id)
    .single();

  if (error || !caso) {
    notFound();
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
