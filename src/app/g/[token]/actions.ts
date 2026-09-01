"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { crearSubidaFirmada, validarMetadatosArchivo } from "@/lib/documentosStorage";
import { CATEGORIAS_GESTOR, CategoriaDocumento } from "@/types/database";

async function casoDeGestor(token: string) {
  const supabase = createServiceClient();
  const { data: caso } = await supabase
    .from("casos")
    .select("id, gestor_id, gestor:gestores(nombre)")
    .eq("token_gestor", token)
    .maybeSingle();

  if (!caso || !caso.gestor_id) return null;
  return caso;
}

// Primer paso de la carga de un documento desde /g/[token]: valida el
// token y los metadatos del archivo (el archivo en sí todavía no viajó) y
// devuelve una URL de subida firmada para que el navegador suba directo a
// Supabase Storage — Vercel limita a 4.5MB el body de cualquier Server
// Action, así que el archivo no puede pasar por acá.
export async function iniciarSubidaGestor(
  token: string,
  categoria: CategoriaDocumento,
  nombreArchivo: string,
  size: number,
  type: string
): Promise<{ path?: string; uploadToken?: string; error?: string }> {
  const caso = await casoDeGestor(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }

  const categoriasValidas = CATEGORIAS_GESTOR.map((c) => c.value);
  if (!categoria || !categoriasValidas.includes(categoria)) {
    return { error: "Elegí una categoría." };
  }

  try {
    validarMetadatosArchivo({ size, type });
    const subida = await crearSubidaFirmada(caso.id, categoria, nombreArchivo);
    return { path: subida.path, uploadToken: subida.token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo iniciar la subida." };
  }
}

// Segundo paso: el archivo ya se subió directo a Storage con el token de
// arriba; acá se registra el documento en la base.
export async function confirmarSubidaGestor(
  token: string,
  categoria: CategoriaDocumento,
  nombreArchivo: string,
  path: string
): Promise<{ ok?: true; error?: string }> {
  const supabase = createServiceClient();
  const caso = await casoDeGestor(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }

  const { error } = await supabase.from("documentos").insert({
    caso_id: caso.id,
    categoria,
    nombre: nombreArchivo,
    url: path
  });

  if (error) {
    return { error: error.message };
  }

  const gestorNombre = (caso.gestor as unknown as { nombre: string } | null)?.nombre ?? "el gestor";
  await supabase.from("historial_cambios").insert({
    caso_id: caso.id,
    usuario_id: null,
    tipo_cambio: `Agregó documento: ${nombreArchivo}`,
    detalle: `Cargado por ${gestorNombre} vía enlace público, categoría: ${categoria}`
  });

  revalidatePath(`/g/${token}`);
  return { ok: true };
}

// Server Action que le permite al gestor externo cargar una observación
// libre desde /g/[token], sin sesión. Queda como un evento de bitácora
// "Observaciones" más, con el autor identificado en el propio texto (no
// hay usuario/creado_por porque el gestor no tiene cuenta en el sistema).
export async function agregarObservacionGestor(
  token: string,
  texto: string
): Promise<{ ok?: true; error?: string }> {
  const supabase = createServiceClient();
  const caso = await casoDeGestor(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }

  if (!texto.trim()) {
    return { error: "Escribí una observación." };
  }

  const gestorNombre = (caso.gestor as unknown as { nombre: string } | null)?.nombre ?? "el gestor";

  const { error } = await supabase.from("bitacora").insert({
    caso_id: caso.id,
    tipo_evento: "Observaciones",
    observacion: `Autor: Gestor (${gestorNombre})\n${texto.trim()}`,
    completado: true,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    creado_por: null
  });

  if (error) {
    return { error: error.message };
  }

  await supabase.from("historial_cambios").insert({
    caso_id: caso.id,
    usuario_id: null,
    tipo_cambio: "Agregó una observación",
    detalle: `Cargada por ${gestorNombre} vía enlace público`
  });

  revalidatePath(`/g/${token}`);
  return { ok: true };
}
