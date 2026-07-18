import { createClient } from "@/lib/supabase/server";

// Backup completo en JSON de todas las tablas, sin resolver relaciones
// (tal cual están en la base), para poder restaurar o migrar si hiciera
// falta. Pensado como respaldo "duro" además de los exports en CSV.
export async function GET() {
  const supabase = createClient();

  const tablas = [
    "aseguradoras",
    "asegurados",
    "vehiculos",
    "desarmaderos",
    "registros_automotores",
    "tipos_baja",
    "usuarios",
    "casos",
    "bitacora",
    "documentos"
  ] as const;

  const resultados = await Promise.all(
    tablas.map((t) => supabase.from(t).select("*"))
  );

  const error = resultados.find((r) => r.error)?.error;
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const backup: Record<string, unknown> = {
    generado_en: new Date().toISOString()
  };
  tablas.forEach((t, i) => {
    backup[t] = resultados[i].data;
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup_completo_${fecha}.json"`
    }
  });
}
