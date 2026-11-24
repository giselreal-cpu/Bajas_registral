import type { SupabaseClient } from "@supabase/supabase-js";
import { esInformeDominio } from "@/lib/documentosVisiblesExternos";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import type { AdjuntoEmail } from "@/lib/email/enviarEmail";

// Tope del total adjunto: Gmail admite 25 MB por mail.
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const EXT_POR_TIPO: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic"
};

// Nombre del archivo adjunto: el nombre del documento + la extensión del
// archivo guardado (o la que indica el tipo de contenido).
export function nombreAdjunto(nombre: string, ruta: string, contentType?: string | null): string {
  const base = nombre.trim().replace(/[\\/:*?"<>|]+/g, "_") || "Informe de dominio";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const limpia = ruta.split("?")[0];
  const m = /\.([a-z0-9]{2,5})$/i.exec(limpia);
  const ext = m ? `.${m[1].toLowerCase()}` : EXT_POR_TIPO[(contentType ?? "").split(";")[0]] ?? "";
  return `${base}${ext}`;
}

export interface ResultadoAdjuntos {
  adjuntos: AdjuntoEmail[];
  // Por qué no hay adjuntos (no hay informe cargado, no se pudo leer, etc.).
  error?: string;
}

// Descarga los "Informe de dominio" cargados en Documentos del caso, listos
// para adjuntar al mail.
export async function obtenerAdjuntosInformeDominio(
  supabase: SupabaseClient,
  casoId: string
): Promise<ResultadoAdjuntos> {
  const { data, error } = await supabase.from("documentos").select("id, nombre, url").eq("caso_id", casoId);
  if (error) return { adjuntos: [], error: "No se pudieron leer los documentos del caso." };

  const informes = (data ?? []).filter((d) => esInformeDominio(d.nombre));
  if (informes.length === 0) {
    return {
      adjuntos: [],
      error: `No hay un "Informe de dominio" cargado en Documentos para adjuntar. Cargalo y volvé a enviar el aviso.`
    };
  }

  const adjuntos: AdjuntoEmail[] = [];
  let total = 0;
  for (const doc of informes) {
    const url = await obtenerUrlFirmada(doc.url);
    if (!url) return { adjuntos: [], error: `No se pudo acceder al archivo "${doc.nombre}".` };
    let respuesta: Response;
    try {
      respuesta = await fetch(url);
    } catch {
      return { adjuntos: [], error: `No se pudo descargar el archivo "${doc.nombre}".` };
    }
    if (!respuesta.ok) return { adjuntos: [], error: `No se pudo descargar el archivo "${doc.nombre}".` };
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    total += contenido.length;
    if (total > MAX_TOTAL_BYTES) {
      return { adjuntos: [], error: "Los informes de dominio superan el tamaño máximo para adjuntar al mail." };
    }
    const contentType = respuesta.headers.get("content-type") ?? undefined;
    adjuntos.push({ filename: nombreAdjunto(doc.nombre, doc.url, contentType), content: contenido, contentType });
  }
  return { adjuntos };
}
