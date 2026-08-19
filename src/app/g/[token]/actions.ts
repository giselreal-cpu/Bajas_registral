"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { esArchivo, subirArchivoDocumento } from "@/lib/documentosStorage";
import { CATEGORIAS_GESTOR, CategoriaDocumento } from "@/types/database";

// Server Action que usa el gestor externo desde /g/[token], sin sesión. Se
// valida el token contra `casos` y se escribe con el service client (no hay
// auth.uid() para pasar las políticas RLS normales).
export async function subirDocumentoGestor(
  token: string,
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  const supabase = createServiceClient();

  const { data: caso } = await supabase
    .from("casos")
    .select("id, gestor_id, gestor:gestores(nombre)")
    .eq("token_gestor", token)
    .maybeSingle();

  if (!caso || !caso.gestor_id) {
    return { error: "Este enlace ya no es válido." };
  }

  const file = formData.get("file");
  const categoria = formData.get("categoria") as CategoriaDocumento | null;
  const categoriasValidas = CATEGORIAS_GESTOR.map((c) => c.value);

  if (!esArchivo(file) || file.size === 0 || !categoria || !categoriasValidas.includes(categoria)) {
    return { error: "Elegí una categoría y un archivo." };
  }

  let path: string;
  try {
    path = await subirArchivoDocumento(caso.id, categoria, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }

  const { error } = await supabase.from("documentos").insert({
    caso_id: caso.id,
    categoria,
    nombre: file.name,
    url: path
  });

  if (error) {
    return { error: error.message };
  }

  const gestorNombre = (caso.gestor as unknown as { nombre: string } | null)?.nombre ?? "el gestor";
  await supabase.from("historial_cambios").insert({
    caso_id: caso.id,
    usuario_id: null,
    tipo_cambio: `Agregó documento: ${file.name}`,
    detalle: `Cargado por ${gestorNombre} vía enlace público, categoría: ${categoria}`
  });

  revalidatePath(`/g/${token}`);
  return { ok: true };
}
