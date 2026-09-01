"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { crearSubidaFirmada, validarMetadatosArchivo } from "@/lib/documentosStorage";

async function eventoDeFormularioBaja(token: string) {
  const supabase = createServiceClient();
  const { data: evento } = await supabase
    .from("bitacora")
    .select("caso_id, formulario_baja_nombre")
    .eq("token_formulario_baja", token)
    .eq("tipo_evento", "Formulario de Baja")
    .maybeSingle();

  if (!evento || !evento.formulario_baja_nombre) return null;
  return evento;
}

// Primer paso de la carga desde /fb/[token]: valida el token y los
// metadatos del archivo (el archivo en sí todavía no viajó) y devuelve una
// URL de subida firmada para que el navegador suba directo a Supabase
// Storage — Vercel limita a 4.5MB el body de cualquier Server Action, así
// que el archivo no puede pasar por acá.
export async function iniciarSubidaFormularioBaja(
  token: string,
  nombreArchivo: string,
  size: number,
  type: string
): Promise<{ path?: string; uploadToken?: string; error?: string }> {
  const evento = await eventoDeFormularioBaja(token);
  if (!evento) {
    return { error: "Este enlace ya no es válido." };
  }

  try {
    validarMetadatosArchivo({ size, type });
    const subida = await crearSubidaFirmada(evento.caso_id, "formulario_baja", nombreArchivo);
    return { path: subida.path, uploadToken: subida.token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo iniciar la subida." };
  }
}

// Segundo paso: el archivo ya se subió directo a Storage con el token de
// arriba; acá se registra el documento en la base.
export async function confirmarSubidaFormularioBaja(
  token: string,
  nombreArchivo: string,
  path: string
): Promise<{ ok?: true; error?: string }> {
  const supabase = createServiceClient();
  const evento = await eventoDeFormularioBaja(token);
  if (!evento) {
    return { error: "Este enlace ya no es válido." };
  }

  const { error } = await supabase.from("documentos").insert({
    caso_id: evento.caso_id,
    categoria: "formulario_baja",
    nombre: nombreArchivo,
    url: path
  });

  if (error) {
    return { error: error.message };
  }

  await supabase.from("historial_cambios").insert({
    caso_id: evento.caso_id,
    usuario_id: null,
    tipo_cambio: `Agregó documento: ${nombreArchivo}`,
    detalle: `Cargado por ${evento.formulario_baja_nombre} vía enlace público de Formulario de Baja`
  });

  revalidatePath(`/fb/${token}`);
  return { ok: true };
}
