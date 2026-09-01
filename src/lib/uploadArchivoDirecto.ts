import { createClient } from "@/lib/supabase/client";

const BUCKET = "documentos-casos";

// Sube el archivo DIRECTO desde el navegador a Supabase Storage usando una
// URL de subida firmada (ver crearSubidaFirmada en documentosStorage.ts) —
// nunca pasa por una función serverless de Vercel, así que no choca con su
// límite de 4.5MB por request. El token firmado ya autoriza esta subida
// puntual, no hace falta sesión ni políticas RLS del bucket.
export async function subirArchivoDirecto(
  path: string,
  token: string,
  file: File
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, {
    contentType: file.type || undefined
  });

  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }
}
