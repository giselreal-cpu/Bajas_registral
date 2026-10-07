import { createClient } from "@/lib/supabase/server";
import { generarXlsxTabla, traerTodo, xlsxResponse } from "@/lib/xlsxTabla";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  imagen_dominio: "Imagen del dominio",
  documento_compania: "Documento para la compañía",
  turno_registro: "Gestor — Turno en Registro",
  observaciones_gestor: "Gestor — Observaciones",
  recibos_gestor: "Gestor — Recibos",
  otros_gestor: "Gestor — Otros",
  formulario_baja: "Formulario de baja",
  comprobante_gasto: "Comprobante de gasto",
  anexo04_rudac: "Anexo 04 RUDAC",
  multa_desarmadero: "Desarmadero — Multas",
  patente_desarmadero: "Desarmadero — Patentes",
  otro_desarmadero: "Desarmadero — Otros"
};

export async function GET() {
  const supabase = createClient();

  let data: any[];
  try {
    data = await traerTodo<any>((d, h) =>
      supabase
        .from("documentos")
        .select(
          `
      categoria, nombre, url, created_at,
      caso:casos(numero_siniestro)
    `
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(d, h)
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudieron leer los documentos.", { status: 500 });
  }

  const filas = data.map((d: any) => ({
    numero_siniestro: d.caso?.numero_siniestro ?? "",
    categoria: ETIQUETA_CATEGORIA[d.categoria] ?? d.categoria,
    nombre: d.nombre,
    url: d.url,
    fecha_carga: d.created_at
  }));

  const buffer = await generarXlsxTabla(
    "Documentos",
    [
      { key: "numero_siniestro", label: "N° Siniestro", tipo: "texto", ancho: 18 },
      { key: "categoria", label: "Categoría", ancho: 28 },
      { key: "nombre", label: "Nombre", ancho: 40 },
      { key: "url", label: "URL", ancho: 60 },
      { key: "fecha_carga", label: "Fecha de Carga", tipo: "fechahora" }
    ],
    filas
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `documentos_${fecha}.xlsx`);
}
