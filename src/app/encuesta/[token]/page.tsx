import { createServiceClient } from "@/lib/supabase/serviceClient";
import EncuestaForm from "./EncuestaForm";

export const dynamic = "force-dynamic";

interface EncuestaConCaso {
  id: string;
  respondida: boolean;
  caso: {
    numero_siniestro: string;
    vehiculo: { dominio: string } | null;
  } | null;
}

export default async function EncuestaPublicaPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("encuestas_satisfaccion")
    .select(
      `
      id, respondida,
      caso:casos(numero_siniestro, vehiculo:vehiculos(dominio))
    `
    )
    .eq("token", params.token)
    .maybeSingle();

  const encuesta = data as unknown as EncuestaConCaso | null;

  if (!encuesta) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Enlace inválido</h1>
        <p className="text-sm text-slate-500">
          Este enlace no es válido o ya no está activo.
        </p>
      </div>
    );
  }

  if (encuesta.respondida) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">¡Gracias por tu respuesta!</h1>
        <p className="text-sm text-slate-500">Esta encuesta ya fue completada.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Encuesta de satisfacción</h1>
        <p className="text-sm text-slate-500">
          Caso {encuesta.caso?.numero_siniestro ?? ""}
          {encuesta.caso?.vehiculo?.dominio ? ` · ${encuesta.caso.vehiculo.dominio}` : ""}
        </p>
      </div>

      <section className="card p-4">
        <EncuestaForm token={params.token} />
      </section>
    </div>
  );
}
