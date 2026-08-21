"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { esArchivo, subirArchivoDocumento } from "@/lib/documentosStorage";

// Server Action que usa la persona asignada al Formulario de Baja desde
// /fb/[token], sin sesión. Se valida el token contra `bitacora` y se
// escribe con el service client (no hay auth.uid() para pasar las
// políticas RLS normales).
export async function subirDocumentoFormularioBaja(
  token: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  const supabase = createServiceClient();

  const { data: evento } = await supabase
    .from("bitacora")
    .select("caso_id, formulario_baja_nombre")
    .eq("token_formulario_baja", token)
    .eq("tipo_evento", "Formulario de Baja")
    .maybeSingle();

  if (!evento || !evento.formulario_baja_nombre) {
    return { error: "Este enlace ya no es válido." };
  }

  const file = formData.get("file");

  if (!esArchivo(file) || file.size === 0) {
    return { error: "Elegí un archivo para subir." };
  }

  let path: string;
  try {
    path = await subirArchivoDocumento(evento.caso_id, "formulario_baja", file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }

  const { error } = await supabase.from("documentos").insert({
    caso_id: evento.caso_id,
    categoria: "formulario_baja",
    nombre: file.name,
    url: path
  });

  if (error) {
    return { error: error.message };
  }

  await supabase.from("historial_cambios").insert({
    caso_id: evento.caso_id,
    usuario_id: null,
    tipo_cambio: `Agregó documento: ${file.name}`,
    detalle: `Cargado por ${evento.formulario_baja_nombre} vía enlace público de Formulario de Baja`
  });

  revalidatePath(`/fb/${token}`);
  return { ok: true };
}
