import type { SupabaseClient } from "@supabase/supabase-js";
import { esInformeDominio } from "@/lib/documentosVisiblesExternos";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";
import type { AdjuntoEmail } from "@/lib/email/enviarEmail";

// Tope del total adjunto: Gmail admite 25 MB por mail.
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const TIMEOUT_DESCARGA_MS = 15000;

// Los documentos cargados como enlace externo (típicamente un link de Google
// Drive) apuntan a una página web, no al archivo: se intenta bajar el archivo
// real y, si no se puede, el informe va como enlace en el cuerpo del mail.
// Link de Drive -> link de descarga directa (solo funciona si el archivo está
// compartido con "cualquiera que tenga el enlace").
export function urlDescargaDirecta(url: string): string {
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(url)) return url;
  const id = /\/file\/d\/([\w-]+)/.exec(url)?.[1] ?? /[?&]id=([\w-]+)/.exec(url)?.[1];
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

// Qué archivo es, mirando los primeros bytes (no el tipo de contenido que
// declare el servidor, que para un link de Drive es una página HTML). Si no es
// un PDF ni una imagen, no se adjunta.
export function extensionPorContenido(contenido: Buffer): string | null {
  const b = contenido;
  if (b.length < 12) return null;
  if (b.subarray(0, 4).toString("latin1") === "%PDF") return ".pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ".png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ".jpg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return ".webp";
  if (b.subarray(4, 8).toString("latin1") === "ftyp") return ".heic";
  return null;
}

// Nombre del archivo adjunto: el nombre del documento + la extensión real.
export function nombreAdjunto(nombre: string, extension: string): string {
  const base = nombre.trim().replace(/[\\/:*?"<>|]+/g, "_") || "Informe de dominio";
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

export interface ResultadoAdjuntos {
  adjuntos: AdjuntoEmail[];
  // Informes que no se pudieron adjuntar (enlace externo que no baja como
  // archivo): van como enlace en el cuerpo del mail.
  enlaces: string[];
  // Por qué no hay informe para mandar (no hay uno cargado, no se pudo leer).
  error?: string;
}

// Arma los informes de dominio del caso para el mail: los "Informe de dominio"
// cargados en Documentos, adjuntos como archivo o, si no se puede, como enlace.
export async function obtenerAdjuntosInformeDominio(
  supabase: SupabaseClient,
  casoId: string
): Promise<ResultadoAdjuntos> {
  const { data, error } = await supabase.from("documentos").select("id, nombre, url").eq("caso_id", casoId);
  if (error) return { adjuntos: [], enlaces: [], error: "No se pudieron leer los documentos del caso." };

  const informes = (data ?? []).filter((d) => esInformeDominio(d.nombre));
  if (informes.length === 0) {
    return {
      adjuntos: [],
      enlaces: [],
      error: `No hay un "Informe de dominio" cargado en Documentos para adjuntar. Cargalo y volvé a enviar el aviso.`
    };
  }

  const adjuntos: AdjuntoEmail[] = [];
  const enlaces: string[] = [];
  let total = 0;
  for (const doc of informes) {
    const esExterno = /^https?:\/\//i.test(doc.url);
    const url = await obtenerUrlFirmada(doc.url);
    if (!url) return { adjuntos: [], enlaces: [], error: `No se pudo acceder al archivo "${doc.nombre}".` };

    let contenido: Buffer | null = null;
    try {
      const respuesta = await fetch(urlDescargaDirecta(url), { signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS) });
      if (respuesta.ok) contenido = Buffer.from(await respuesta.arrayBuffer());
    } catch {
      contenido = null;
    }
    const extension = contenido ? extensionPorContenido(contenido) : null;

    if (contenido && extension) {
      total += contenido.length;
      if (total > MAX_TOTAL_BYTES) {
        return {
          adjuntos: [],
          enlaces: [],
          error: "Los informes de dominio superan el tamaño máximo para adjuntar al mail."
        };
      }
      adjuntos.push({ filename: nombreAdjunto(doc.nombre, extension), content: contenido });
    } else if (esExterno) {
      // Enlace externo que no baja como archivo (ej.: Drive sin acceso público).
      enlaces.push(doc.url);
    } else {
      return { adjuntos: [], enlaces: [], error: `No se pudo descargar el archivo "${doc.nombre}".` };
    }
  }
  return { adjuntos, enlaces };
}
