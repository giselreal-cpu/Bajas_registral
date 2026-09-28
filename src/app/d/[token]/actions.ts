"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { generarAnexo04, Decisiones } from "@/lib/anexo04";
import { TIPOS_VEHICULO } from "@/types/database";

const BUCKET = "documentos-casos";
const TEMPLATE_PATH = path.join(process.cwd(), "public", "anexo04_original.pdf");

async function casoDeDesarmadero(token: string) {
  const supabase = createServiceClient();
  const { data: caso } = await supabase
    .from("casos")
    .select(
      "id, numero_siniestro, desarmadero_id, vehiculo_id, vehiculo:vehiculos(dominio, tipo_vehiculo), desarmadero:desarmaderos(nombre)"
    )
    .eq("token_desarmadero", token)
    .maybeSingle();

  if (!caso || !caso.desarmadero_id) return null;
  return caso;
}

// Observación cargada por el desarmadero desde su enlace público, sin
// login. Queda como un evento de bitácora "Observaciones" más (no
// interna) — la ven ellos mismos (releyendo esta misma página),
// operador/administrador desde el caso, y nunca compañía (esa
// redacción ya es una regla dura en toda la app, independiente de
// es_interna) ni otro desarmadero (cada uno solo entra con el token de
// SU caso).
export async function agregarObservacionDesarmadero(
  token: string,
  texto: string
): Promise<{ ok?: true; error?: string }> {
  const caso = await casoDeDesarmadero(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }
  if (!texto.trim()) {
    return { error: "Escribí una observación." };
  }

  const supabase = createServiceClient();
  const desarmaderoNombre =
    (caso.desarmadero as unknown as { nombre: string } | null)?.nombre ?? "el desarmadero";

  const { error } = await supabase.from("bitacora").insert({
    caso_id: caso.id,
    tipo_evento: "Observaciones",
    observacion: `Autor: Desarmadero (${desarmaderoNombre})\n${texto.trim()}`,
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
    detalle: `Cargada por ${desarmaderoNombre} vía enlace público`
  });

  revalidatePath(`/d/${token}`);
  return { ok: true };
}

// El desarmadero también puede elegir/cambiar el tipo de vehículo del
// caso — es la clave para resolver las reglas. Auto-completa
// caso_piezas_rudac desde reglas_piezas_rudac (sin pisar excepciones ya
// cargadas), mismo criterio que PUT /api/casos/[id]/anexo04/tipo-vehiculo
// para el equipo interno.
export async function guardarTipoVehiculoDesarmadero(
  token: string,
  tipoVehiculo: string
): Promise<{ ok?: true; error?: string }> {
  const caso = await casoDeDesarmadero(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }
  if (!TIPOS_VEHICULO.includes(tipoVehiculo as (typeof TIPOS_VEHICULO)[number])) {
    return { error: "Tipo de vehículo inválido." };
  }

  const supabase = createServiceClient();

  const { error: errVehiculo } = await supabase
    .from("vehiculos")
    .update({ tipo_vehiculo: tipoVehiculo })
    .eq("id", caso.vehiculo_id);

  if (errVehiculo) {
    return { error: errVehiculo.message };
  }

  const { data: reglas, error: errReglas } = await supabase
    .from("reglas_piezas_rudac")
    .select("codigo, decision")
    .eq("tipo_vehiculo", tipoVehiculo)
    .in("decision", ["SI", "NO"]);

  if (errReglas) {
    return { error: errReglas.message };
  }

  if (reglas && reglas.length > 0) {
    const filas = reglas.map((r) => ({ caso_id: caso.id, codigo: r.codigo, decision: r.decision }));
    const { error: errAutofill } = await supabase
      .from("caso_piezas_rudac")
      .upsert(filas, { onConflict: "caso_id,codigo", ignoreDuplicates: true });

    if (errAutofill) {
      return { error: errAutofill.message };
    }
  }

  revalidatePath(`/d/${token}`);
  return { ok: true };
}

// Excepción puntual por pieza, cargada/editada por el desarmadero. Pisa
// lo que haya resuelto la regla general para este caso puntual — se
// puede volver a editar las veces que haga falta, incluso después de
// haber generado el PDF (no queda "bloqueado").
export async function guardarDecisionPiezaDesarmadero(
  token: string,
  codigo: string,
  decision: "SI" | "NO" | null
): Promise<{ ok?: true; error?: string }> {
  const caso = await casoDeDesarmadero(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("caso_piezas_rudac")
    .upsert({ caso_id: caso.id, codigo, decision }, { onConflict: "caso_id,codigo" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/d/${token}`);
  return { ok: true };
}

// Genera el Anexo 04 con las decisiones ya cargadas y lo deja disponible
// para descargar en la misma página — el desarmadero puede repetir esto
// las veces que necesite (cada generación reemplaza el PDF anterior como
// "el último Anexo 04" que se ve en Documentación).
export async function generarAnexo04Desarmadero(
  token: string
): Promise<{ ok?: true; error?: string }> {
  const caso = await casoDeDesarmadero(token);
  if (!caso) {
    return { error: "Este enlace ya no es válido." };
  }

  const vehiculo = caso.vehiculo as unknown as { dominio: string; tipo_vehiculo: string | null } | null;
  if (!vehiculo?.tipo_vehiculo) {
    return { error: "Elegí primero el tipo de vehículo." };
  }

  const supabase = createServiceClient();

  const { data: decisionesRaw, error: errDecisiones } = await supabase
    .from("caso_piezas_rudac")
    .select("codigo, decision")
    .eq("caso_id", caso.id)
    .in("decision", ["SI", "NO"]);

  if (errDecisiones) {
    return { error: errDecisiones.message };
  }

  const decisiones: Decisiones = {};
  for (const d of decisionesRaw ?? []) {
    decisiones[d.codigo] = d.decision as "SI" | "NO";
  }

  const templateBytes = await fs.promises.readFile(TEMPLATE_PATH);
  const pdfBytes = await generarAnexo04(templateBytes, decisiones, vehiculo.dominio);

  const nombre = `Anexo 04 - ${caso.numero_siniestro}.pdf`;
  const storagePath = `casos/${caso.id}/anexo04_rudac/${Date.now()}-anexo04.pdf`;

  const { error: errUpload } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });

  if (errUpload) {
    return { error: `No se pudo subir el archivo: ${errUpload.message}` };
  }

  const { error: errDocumento } = await supabase
    .from("documentos")
    .insert({ caso_id: caso.id, categoria: "anexo04_rudac", nombre, url: storagePath });

  if (errDocumento) {
    return { error: errDocumento.message };
  }

  await supabase.from("historial_cambios").insert({
    caso_id: caso.id,
    usuario_id: null,
    tipo_cambio: "Generó el Anexo 04 (Piezas RUDAC)",
    detalle: "Generado por el desarmadero vía enlace público"
  });

  revalidatePath(`/d/${token}`);
  return { ok: true };
}
