import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { ESTADOS } from "@/types/database";

interface CasoRow {
  id: string;
  numero_siniestro: string;
  estado: string;
  responsable_id: string | null;
  gestor: { nombre: string } | null;
  asegurado: { nombre: string } | null;
  vehiculo: { dominio: string; marca: string | null; modelo: string | null } | null;
  aseguradora: { nombre: string } | null;
}

interface BitacoraRow {
  caso_id: string;
  tipo_evento: string;
  observacion: string | null;
  es_interna: boolean;
  fecha_inicio: string;
  created_at: string;
}

// PostgREST corta cada consulta en 1000 filas (mismo problema que ya se
// arregló en panelData.ts) — se pagina hasta traer todo.
async function traerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const TAM = 1000;
  const todo: T[] = [];
  for (let desde = 0; ; desde += TAM) {
    const { data } = await pagina(desde, desde + TAM - 1);
    todo.push(...(data ?? []));
    if (!data || data.length < TAM) break;
  }
  return todo;
}

// GET /api/export/casos-por-gestor -> un renglón por caso asignado a un
// gestor de campo, con el último evento cargado en su bitácora (el más
// reciente por fecha de carga), su fecha y su observación.
export async function GET() {
  const supabase = createClient();
  const usuarioActual = await getUsuarioActual();

  const [casos, bitacora] = await Promise.all([
    traerTodo<CasoRow>(
      (d, h) =>
        supabase
          .from("casos")
          .select(
            `
          id, numero_siniestro, estado, responsable_id,
          gestor:gestores(nombre),
          asegurado:asegurados(nombre),
          vehiculo:vehiculos(dominio, marca, modelo),
          aseguradora:aseguradoras(nombre)
        `
          )
          .not("gestor_id", "is", null)
          .order("id")
          .range(d, h) as unknown as PromiseLike<{ data: CasoRow[] | null }>
    ),
    traerTodo<BitacoraRow>((d, h) =>
      supabase
        .from("bitacora")
        .select("caso_id, tipo_evento, observacion, es_interna, fecha_inicio, created_at")
        .order("id")
        .range(d, h)
    )
  ]);

  const ultimoEventoPorCaso = new Map<string, BitacoraRow>();
  for (const ev of bitacora) {
    const actual = ultimoEventoPorCaso.get(ev.caso_id);
    if (!actual || ev.created_at > actual.created_at) {
      ultimoEventoPorCaso.set(ev.caso_id, ev);
    }
  }

  const filas = casos
    .filter((c) => c.gestor)
    .map((c) => {
      const ultimo = ultimoEventoPorCaso.get(c.id);
      const puedeVerObservacion =
        !ultimo?.es_interna ||
        usuarioActual?.rol === "administrador" ||
        c.responsable_id === usuarioActual?.id;

      return {
        gestor: c.gestor?.nombre ?? "",
        numero_siniestro: c.numero_siniestro,
        asegurado: c.asegurado?.nombre ?? "",
        dominio: c.vehiculo?.dominio ?? "",
        vehiculo: [c.vehiculo?.marca, c.vehiculo?.modelo].filter(Boolean).join(" "),
        aseguradora: c.aseguradora?.nombre ?? "",
        estado: ESTADOS.find((e) => e.value === c.estado)?.label ?? c.estado,
        ultimo_evento: ultimo?.tipo_evento ?? "",
        fecha_ultimo_evento: ultimo?.fecha_inicio ?? "",
        observacion_ultimo_evento: ultimo
          ? puedeVerObservacion
            ? ultimo.observacion ?? ""
            : "[Observación interna - oculta]"
          : ""
      };
    })
    .sort((a, b) => a.gestor.localeCompare(b.gestor) || a.numero_siniestro.localeCompare(b.numero_siniestro));

  const csv = toCsv(filas, [
    { key: "gestor", label: "Gestor" },
    { key: "numero_siniestro", label: "N° Siniestro" },
    { key: "asegurado", label: "Asegurado" },
    { key: "dominio", label: "Dominio" },
    { key: "vehiculo", label: "Marca/Modelo" },
    { key: "aseguradora", label: "Aseguradora" },
    { key: "estado", label: "Estado" },
    { key: "ultimo_evento", label: "Último Evento" },
    { key: "fecha_ultimo_evento", label: "Fecha del Evento" },
    { key: "observacion_ultimo_evento", label: "Observación del Evento" }
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `casos_por_gestor_${fecha}.csv`);
}
