import { createServiceClient } from "@/lib/supabase/serviceClient";

const BUCKET = "documentos-casos";
const TAMANIO_MAXIMO = 10 * 1024 * 1024; // 10MB
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

function validarArchivo(file: File) {
  if (file.size > TAMANIO_MAXIMO) {
    throw new Error("El archivo no puede superar los 10MB.");
  }
  if (file.type && !TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error("Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) o PDF.");
  }
}

// Sube un archivo al bucket privado de documentos y devuelve la ruta interna
// (se guarda en documentos.url; para mostrarla hay que pedir una URL firmada
// con obtenerUrlFirmada).
export async function subirArchivoDocumento(
  casoId: string,
  categoria: string,
  file: File
): Promise<string> {
  validarArchivo(file);

  const nombreSanitizado = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `casos/${casoId}/${categoria}/${Date.now()}-${nombreSanitizado}`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined
  });

  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }

  return path;
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
