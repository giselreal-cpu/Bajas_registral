import { createServiceClient } from "@/lib/supabase/serviceClient";

const BUCKET = "documentos-casos";
const TAMANIO_MAXIMO = 10 * 1024 * 1024; // 10MB
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

// `formData.get("file")` a veces devuelve un objeto File que no pasa
// `instanceof File` (por ejemplo si el runtime tiene más de una clase
// File cargada al mismo tiempo) aunque sea un archivo real y válido. Se
// verifica "por forma" en vez de por clase para no depender de eso.
export function esArchivo(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).name === "string"
  );
}

export function validarMetadatosArchivo(meta: { size: number; type: string }) {
  if (meta.size > TAMANIO_MAXIMO) {
    throw new Error("El archivo no puede superar los 10MB.");
  }
  if (meta.type && !TIPOS_PERMITIDOS.includes(meta.type)) {
    throw new Error("Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) o PDF.");
  }
}

export interface SubidaFirmada {
  path: string;
  token: string;
}

// Genera una URL de subida firmada para que el navegador suba el archivo
// DIRECTO a Supabase Storage, sin pasar por una función serverless de
// Vercel. Vercel limita a 4.5MB el body de cualquier función (Server
// Action o Route Handler) sin excepción — muy por debajo de los 10MB que
// la app permite — así que un archivo real nunca puede viajar por ahí;
// tiene que subirse directo desde el cliente con este token.
export async function crearSubidaFirmada(
  casoId: string,
  categoria: string,
  nombreArchivo: string
): Promise<SubidaFirmada> {
  const nombreSanitizado = nombreArchivo.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `casos/${casoId}/${categoria}/${Date.now()}-${nombreSanitizado}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error) {
    throw new Error(`No se pudo generar la subida: ${error.message}`);
  }

  return { path, token: data.token };
}

// Documentos cargados antes de este bucket (o pegados a mano por fuera del
// sistema) tienen en `url` un link externo completo, no una ruta interna:
// se devuelven tal cual, sin intentar firmarlos.
function esUrlExterna(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

export async function obtenerUrlFirmada(path: string, expiraEnSegundos = 3600): Promise<string | null> {
  if (esUrlExterna(path)) return path;

  const supabase = createServiceClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiraEnSegundos);
  return data?.signedUrl ?? null;
}

export async function eliminarArchivoStorage(path: string): Promise<void> {
  if (esUrlExterna(path)) return;

  const supabase = createServiceClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
