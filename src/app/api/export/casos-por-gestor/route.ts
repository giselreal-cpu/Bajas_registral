import { createClient } from "@/lib/supabase/server";
import { generarXlsxTabla, traerTodo, xlsxResponse } from "@/lib/xlsxTabla";
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

interface HonorarioRow {
  caso_id: string;
  monto: number;
  pagado: boolean;
  fecha: string;
  fecha_pago: string | null;
  observacion: string | null;
}

// Concepto con el que se carga el pago al gestor de campo.
const CONCEPTO_GESTORIA = "Honorarios por Gestoría";

// GET /api/export/casos-por-gestor -> un renglón por caso asignado a un
// gestor de campo, con el último evento cargado en su bitácora (el más
// reciente por fecha de carga), su fecha y su observación, más el pago de
// honorarios por gestoría (monto, fecha de pago y la observación del
// movimiento — donde suele anotarse el N° de factura o de comprobante).
export async function GET() {
  const supabase = createClient();
  const usuarioActual = await getUsuarioActual();

  const { data: concepto } = await supabase
    .from("conceptos_movimiento")
    .select("id")
    .eq("nombre", CONCEPTO_GESTORIA)
    .maybeSingle();

  let casos: CasoRow[];
  let bitacora: BitacoraRow[];
  let honorarios: HonorarioRow[] = [];
  try {
    [casos, bitacora, honorarios] = await Promise.all([
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
    ),
    concepto
      ? traerTodo<HonorarioRow>((d, h) =>
          supabase
            .from("movimientos_caso")
            .select("caso_id, monto, pagado, fecha, fecha_pago, observacion")
            .eq("concepto_id", concepto.id)
            .eq("anulado", false)
            .order("id")
            .range(d, h)
        )
      : Promise.resolve([] as HonorarioRow[])
    ]);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "No se pudieron leer los datos.", { status: 500 });
  }

  const honorariosPorCaso = new Map<string, HonorarioRow[]>();
  for (const m of honorarios) {
    const lista = honorariosPorCaso.get(m.caso_id) ?? [];
    lista.push(m);
    honorariosPorCaso.set(m.caso_id, lista);
  }

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

      const pagos = (honorariosPorCaso.get(c.id) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const fechasPago = pagos.filter((p) => p.pagado).map((p) => p.fecha_pago ?? p.fecha);
      const estadoPago =
        pagos.length === 0
          ? ""
          : pagos.every((p) => p.pagado)
            ? "Pagado"
            : pagos.some((p) => p.pagado)
              ? "Pagado parcial"
              : "Pendiente de pago";

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
          : "",
        honorarios_gestoria: pagos.length ? pagos.reduce((acc, p) => acc + Number(p.monto), 0) : "",
        estado_pago: estadoPago,
        fecha_pago: fechasPago.length ? fechasPago.sort().slice(-1)[0] : "",
        observacion_pago: pagos
          .map((p) => (p.observacion ?? "").trim())
          .filter(Boolean)
          .join(" | ")
      };
    })
    .sort((a, b) => a.gestor.localeCompare(b.gestor) || a.numero_siniestro.localeCompare(b.numero_siniestro));

  const buffer = await generarXlsxTabla(
    "Casos por gestor",
    [
      { key: "gestor", label: "Gestor", ancho: 24 },
      { key: "numero_siniestro", label: "N° Siniestro", tipo: "texto", ancho: 18 },
      { key: "asegurado", label: "Asegurado", ancho: 28 },
      { key: "dominio", label: "Dominio", tipo: "texto", ancho: 11 },
      { key: "vehiculo", label: "Marca/Modelo", ancho: 30 },
      { key: "aseguradora", label: "Aseguradora", ancho: 24 },
      { key: "estado", label: "Estado", ancho: 22 },
      { key: "ultimo_evento", label: "Último Evento", ancho: 28 },
      { key: "fecha_ultimo_evento", label: "Fecha del Evento", tipo: "fecha" },
      { key: "observacion_ultimo_evento", label: "Observación del Evento", ancho: 50 },
      { key: "honorarios_gestoria", label: "Honorarios por Gestoría", tipo: "moneda", ancho: 18 },
      { key: "estado_pago", label: "Estado del Pago", ancho: 18 },
      { key: "fecha_pago", label: "Fecha de Pago", tipo: "fecha" },
      { key: "observacion_pago", label: "Observaciones del Movimiento (N° factura / comprobante)", tipo: "texto", ancho: 45 }
    ],
    filas
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `casos_por_gestor_${fecha}.xlsx`);
}
