import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { generarAnexo04, Decisiones } from "@/lib/anexo04";
import { obtenerUrlFirmada } from "@/lib/documentosStorage";

const BUCKET = "documentos-casos";
const TEMPLATE_PATH = path.join(process.cwd(), "public", "anexo04_original.pdf");

// POST /api/casos/[id]/anexo04/generar -> arma el Anexo 04 con las
// decisiones ya resueltas del caso (caso_piezas_rudac), lo sube a Storage
// y lo registra en `documentos`. Mismo patrón que autorizacionRetiro.ts
// para generar, pero acá además se persiste como documento del caso (dibuja
// sobre el PDF original en vez de generar desde cero).
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = createClient();

  const { data: caso, error: errCaso } = await supabase
    .from("casos")
    .select("id, numero_siniestro, vehiculo:vehiculos(dominio, tipo_vehiculo)")
    .eq("id", params.id)
    .single();

  if (errCaso || !caso) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  const vehiculo = caso.vehiculo as unknown as { dominio: string; tipo_vehiculo: string | null } | null;

  if (!vehiculo?.tipo_vehiculo) {
    return NextResponse.json(
      { error: "Elegí primero el tipo de vehículo del caso." },
      { status: 400 }
    );
  }

  const { data: decisionesRaw, error: errDecisiones } = await supabase
    .from("caso_piezas_rudac")
    .select("codigo, decision")
    .eq("caso_id", params.id)
    .in("decision", ["SI", "NO"]);

  if (errDecisiones) {
    return NextResponse.json({ error: errDecisiones.message }, { status: 500 });
  }

  const decisiones: Decisiones = {};
  for (const d of decisionesRaw ?? []) {
    decisiones[d.codigo] = d.decision as "SI" | "NO";
  }

  const templateBytes = await fs.promises.readFile(TEMPLATE_PATH);
  const pdfBytes = await generarAnexo04(templateBytes, decisiones, vehiculo.dominio);

  const nombre = `Anexo 04 - ${caso.numero_siniestro}.pdf`;
  const storagePath = `casos/${params.id}/anexo04_rudac/${Date.now()}-anexo04.pdf`;

  const service = createServiceClient();
  const { error: errUpload } = await service.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });

  if (errUpload) {
    return NextResponse.json({ error: `No se pudo subir el archivo: ${errUpload.message}` }, { status: 500 });
  }

  const { data: documento, error: errDocumento } = await supabase
    .from("documentos")
    .insert({ caso_id: params.id, categoria: "anexo04_rudac", nombre, url: storagePath })
    .select()
    .single();

  if (errDocumento) {
    return NextResponse.json({ error: errDocumento.message }, { status: 500 });
  }

  const url_firmada = await obtenerUrlFirmada(storagePath);

  return NextResponse.json({ data: { ...documento, url_firmada } }, { status: 201 });
}
