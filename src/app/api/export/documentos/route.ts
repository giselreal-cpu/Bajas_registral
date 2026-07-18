import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("documentos")
    .select(
      `
      categoria, nombre, url, created_at,
      caso:casos(numero_siniestro)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filas = (data ?? []).map((d: any) => ({
    numero_siniestro: d.caso?.numero_siniestro ?? "",
    categoria:
      d.categoria === "imagen_dominio" ? "Imagen del dominio" : "Documento para la compañía",
    nombre: d.nombre,
    url: d.url,
    fecha_carga: d.created_at
  }));

  const csv = toCsv(filas, [
    { key: "numero_siniestro", label: "N° Siniestro" },
    { key: "categoria", label: "Categoría" },
    { key: "nombre", label: "Nombre" },
    { key: "url", label: "URL" },
    { key: "fecha_carga", label: "Fecha de Carga" }
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `documentos_${fecha}.csv`);
}
