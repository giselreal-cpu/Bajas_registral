import { createServiceClient } from "@/lib/supabase/serviceClient";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";

export const dynamic = "force-dynamic";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

interface EventoTraslado {
  id: string;
  caso_id: string;
  gruero_nombre: string | null;
  caso: {
    numero_siniestro: string;
    vehiculo: { dominio: string; marca: string | null; modelo: string | null } | null;
  } | null;
}

export default async function EnlaceGrueroPage({
  params
}: {
  params: { token: string };
}) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("bitacora")
    .select(
      `
      id,
      caso_id,
      gruero_nombre,
      caso:casos(numero_siniestro, vehiculo:vehiculos(dominio, marca, modelo))
    `
    )
    .eq("token_gruero", params.token)
    .eq("tipo_evento", "Traslado")
    .maybeSingle();

  const evento = data as unknown as EventoTraslado | null;

  if (!evento || !evento.gruero_nombre) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Enlace inválido</h1>
        <p className="text-sm text-slate-500">
          Este enlace no es válido o ya no está activo. Pedile a quien te lo
          compartió que te envíe uno nuevo.
        </p>
      </div>
    );
  }

  const { data: todosLosDocumentos } = await supabase
    .from("documentos")
    .select("id, nombre, url")
    .eq("caso_id", evento.caso_id)
    .order("created_at", { ascending: false });

  // El gruero solo necesita ver la autorización y el informe de dominio ya
  // cargados en el caso (no todos los documentos) — se buscan por nombre,
  // sin importar en qué categoría estén archivados.
  const relevantes = (todosLosDocumentos ?? []).filter((d) => {
    const n = normalizar(d.nombre);
    return n.includes("autorizacion") || n.includes("informe de dominio");
  });

  const documentos = await Promise.all(
    relevantes.map(async (d) => ({
      ...d,
      url_firmada: await obtenerUrlFirmada(d.url)
    }))
  );

  const caso = evento.caso;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Traslado de {caso?.vehiculo?.dominio ?? "—"}
        </h1>
        <p className="text-sm text-slate-500">
          Hola {evento.gruero_nombre}, acá tenés los datos de la unidad para el traslado.
        </p>
      </div>

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Datos de la unidad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="label">Dominio</div>
            <div className="text-slate-800 uppercase">{caso?.vehiculo?.dominio ?? "—"}</div>
          </div>
          <div>
            <div className="label">Vehículo</div>
            <div className="text-slate-800">
              {[caso?.vehiculo?.marca, caso?.vehiculo?.modelo].filter(Boolean).join(" ") || "—"}
            </div>
          </div>
          <div>
            <div className="label">N° de siniestro</div>
            <div className="text-slate-800">{caso?.numero_siniestro ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-medium text-slate-800 mb-3">Autorización de retiro y traslado</h2>
        <a href={`/gr/${params.token}/autorizacion-retiro`} className="btn-primary">
          Descargar autorización (.docx)
        </a>
      </section>

      {documentos.length > 0 && (
        <section className="card p-4">
          <h2 className="font-medium text-slate-800 mb-3">Documentos del caso</h2>
          <ul className="space-y-1 text-sm">
            {documentos.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url_firmada ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {d.nombre}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
