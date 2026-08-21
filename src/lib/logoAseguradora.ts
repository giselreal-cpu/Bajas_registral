import { createServiceClient } from "@/lib/supabase/serviceClient";
import { createClient } from "@/lib/supabase/server";
import { esArchivo } from "@/lib/documentosStorage";

const BUCKET = "logos-aseguradoras";
const TAMANIO_MAXIMO = 5 * 1024 * 1024; // 5MB
// Solo jpg/png: son los únicos formatos que la librería que arma el
// .docx (docx-js) sabe embeber como ImageRun.
const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png"
};

// Sube (o reemplaza) el logo de una aseguradora y actualiza
// aseguradoras.logo_path. Un logo por aseguradora — el path incluye la
// extensión así que cambiar de formato no deja basura del anterior.
export async function subirLogoAseguradora(aseguradoraId: string, file: unknown): Promise<string> {
  if (!esArchivo(file)) {
    throw new Error("Archivo inválido.");
  }
  if (file.size > TAMANIO_MAXIMO) {
    throw new Error("El logo no puede superar los 5MB.");
  }
  const extension = TIPOS_PERMITIDOS[file.type];
  if (!extension) {
    throw new Error("Solo se aceptan imágenes JPG o PNG.");
  }

  const path = `${aseguradoraId}.${extension}`;
  const service = createServiceClient();

  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true
  });
  if (uploadError) {
    throw new Error(`No se pudo subir el logo: ${uploadError.message}`);
  }

  const supabase = createClient();
  const { error: updateError } = await supabase
    .from("aseguradoras")
    .update({ logo_path: path })
    .eq("id", aseguradoraId);
  if (updateError) {
    throw new Error(`No se pudo guardar el logo: ${updateError.message}`);
  }

  return path;
}

export async function eliminarLogoAseguradora(aseguradoraId: string, path: string): Promise<void> {
  const service = createServiceClient();
  await service.storage.from(BUCKET).remove([path]);

  const supabase = createClient();
  await supabase.from("aseguradoras").update({ logo_path: null }).eq("id", aseguradoraId);
}

// Baja los bytes del logo directo del bucket privado (server-side, con
// service role) para embeberlos en el documento generado — no hace
// falta URL firmada porque nunca se muestra directo en el navegador.
export async function descargarLogoBytes(path: string | null): Promise<Buffer | null> {
  if (!path) return null;
  const service = createServiceClient();
  const { data, error } = await service.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
