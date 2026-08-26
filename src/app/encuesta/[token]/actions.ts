"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/serviceClient";

interface RespuestaEncuesta {
  calificacionContacto: number;
  calificacionTraslado: number;
  calificacionGestoria: number;
  comentario: string;
}

// Server Action que responde la encuesta desde /encuesta/[token], sin
// sesión. Se valida el token contra encuestas_satisfaccion (que todavía
// no esté respondida) y se escribe con el service client (no hay
// auth.uid() para pasar las políticas RLS normales).
export async function responderEncuesta(
  token: string,
  respuesta: RespuestaEncuesta
): Promise<{ ok?: true; error?: string }> {
  const supabase = createServiceClient();

  const { data: encuesta } = await supabase
    .from("encuestas_satisfaccion")
    .select("id, respondida")
    .eq("token", token)
    .maybeSingle();

  if (!encuesta) {
    return { error: "Este enlace no es válido." };
  }
  if (encuesta.respondida) {
    return { error: "Esta encuesta ya fue respondida." };
  }

  const { calificacionContacto, calificacionTraslado, calificacionGestoria, comentario } = respuesta;
  const calificaciones = [calificacionContacto, calificacionTraslado, calificacionGestoria];
  if (calificaciones.some((c) => !Number.isInteger(c) || c < 1 || c > 5)) {
    return { error: "Completá las 3 calificaciones (1 a 5)." };
  }

  const { error } = await supabase
    .from("encuestas_satisfaccion")
    .update({
      calificacion_contacto: calificacionContacto,
      calificacion_traslado: calificacionTraslado,
      calificacion_gestoria: calificacionGestoria,
      comentario: comentario.trim() || null,
      respondida: true,
      respondida_at: new Date().toISOString()
    })
    .eq("id", encuesta.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/encuesta/${token}`);
  return { ok: true };
}
