import { createClient } from "@/lib/supabase/server";
import { MovimientoCaso, MovimientoGeneral } from "@/types/database";

// Arma las filas del Libro de movimientos (compartido entre la página
// de Administración y su exportación a CSV) — ver la nota de "libro de
// CAJA" en administracion/page.tsx: solo entra lo efectivamente pagado
// (egresos) o cobrado (cobros), nunca lo devengado.

export interface LibroFiltros {
  caja_id?: string;
  cuenta_contable_id?: string;
  aseguradora_id?: string;
  desde?: string;
  hasta?: string;
}

export interface FilaLibro {
  key: string;
  fecha: string;
  casoHref: string | null;
  casoLabel: string | null;
  descripcion: string;
  cuentaCodigo: string | null;
  cajaNombre: string | null;
  centroDeCosto: string;
  tipo: "ingreso" | "egreso";
  monto: number;
}

interface MovimientoAdmin extends MovimientoCaso {
  caso: {
    numero_siniestro: string;
    aseguradora_id: string;
    aseguradora: { nombre: string } | null;
    vehiculo: { dominio: string } | null;
  };
}

interface CobroAdmin {
  id: string;
  monto: number;
  fecha: string;
  medio_pago: string | null;
  caja_id: string | null;
  cuenta_contable_id: string | null;
  caja: { nombre: string } | null;
  cuenta_contable: { codigo: string } | null;
  factura: {
    caso_id: string;
    tipo_receptor: string;
    caso: {
      numero_siniestro: string;
      aseguradora_id: string;
      aseguradora: { nombre: string } | null;
      vehiculo: { dominio: string } | null;
    };
  };
}

export async function obtenerFilasLibro(filtros: LibroFiltros) {
  const supabase = createClient();

  let query = supabase
    .from("movimientos_caso")
    .select(
      "*, concepto:conceptos_movimiento(*), caja:cajas(*), cuenta_contable:cuentas_contables(*), caso:casos!inner(numero_siniestro, aseguradora_id, aseguradora:aseguradoras(nombre), vehiculo:vehiculos(dominio))"
    )
    .eq("aprobado", true)
    .eq("pagado", true)
    .or("caja_id.not.is.null,cuenta_contable_id.not.is.null")
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true });

  if (filtros.caja_id) query = query.eq("caja_id", filtros.caja_id);
  if (filtros.cuenta_contable_id) query = query.eq("cuenta_contable_id", filtros.cuenta_contable_id);
  if (filtros.aseguradora_id) query = query.eq("caso.aseguradora_id", filtros.aseguradora_id);
  if (filtros.desde) query = query.gte("fecha", filtros.desde);
  if (filtros.hasta) query = query.lte("fecha", filtros.hasta);

  const { data: movimientosRaw } = await query;
  const movimientos = ((movimientosRaw ?? []) as unknown as MovimientoAdmin[]).filter(
    (m) => m.concepto?.tipo === "egreso"
  );

  let queryCobros = supabase
    .from("cobros")
    .select(
      "id, monto, fecha, medio_pago, caja_id, cuenta_contable_id, caja:cajas(nombre), cuenta_contable:cuentas_contables(codigo), factura:facturas!inner(caso_id, tipo_receptor, caso:casos!inner(numero_siniestro, aseguradora_id, aseguradora:aseguradoras(nombre), vehiculo:vehiculos(dominio)))"
    )
    .or("caja_id.not.is.null,cuenta_contable_id.not.is.null")
    .order("fecha", { ascending: true });

  if (filtros.caja_id) queryCobros = queryCobros.eq("caja_id", filtros.caja_id);
  if (filtros.cuenta_contable_id)
    queryCobros = queryCobros.eq("cuenta_contable_id", filtros.cuenta_contable_id);
  if (filtros.aseguradora_id)
    queryCobros = queryCobros.eq("factura.caso.aseguradora_id", filtros.aseguradora_id);
  if (filtros.desde) queryCobros = queryCobros.gte("fecha", filtros.desde);
  if (filtros.hasta) queryCobros = queryCobros.lte("fecha", filtros.hasta);

  const { data: cobrosRaw } = await queryCobros;
  const cobros = (cobrosRaw ?? []) as unknown as CobroAdmin[];

  // Anticipos: plata real recibida por adelantado (no atada todavía a
  // una factura puntual). El "cobro" que se genera al aplicarlos contra
  // una factura no lleva caja propia (no es plata nueva) — la plata
  // real se cuenta acá, una sola vez, al momento de recibirla.
  interface AnticipoAdmin {
    id: string;
    monto: number;
    fecha: string;
    observacion: string | null;
    tipo_receptor: string;
    receptor_id: string;
    caja_id: string | null;
    cuenta_contable_id: string | null;
    caja: { nombre: string } | null;
    cuenta_contable: { codigo: string } | null;
  }

  let queryAnticipos = supabase
    .from("anticipos")
    .select(
      "id, monto, fecha, observacion, tipo_receptor, receptor_id, caja_id, cuenta_contable_id, caja:cajas(nombre), cuenta_contable:cuentas_contables(codigo)"
    )
    .or("caja_id.not.is.null,cuenta_contable_id.not.is.null")
    .order("fecha", { ascending: true });

  if (filtros.caja_id) queryAnticipos = queryAnticipos.eq("caja_id", filtros.caja_id);
  if (filtros.cuenta_contable_id)
    queryAnticipos = queryAnticipos.eq("cuenta_contable_id", filtros.cuenta_contable_id);
  if (filtros.aseguradora_id)
    queryAnticipos = queryAnticipos.eq("tipo_receptor", "compania").eq("receptor_id", filtros.aseguradora_id);
  if (filtros.desde) queryAnticipos = queryAnticipos.gte("fecha", filtros.desde);
  if (filtros.hasta) queryAnticipos = queryAnticipos.lte("fecha", filtros.hasta);

  const { data: anticiposRaw } = await queryAnticipos;
  const anticipos = (anticiposRaw ?? []) as unknown as AnticipoAdmin[];

  const receptorIds = { compania: new Set<string>(), desarmadero: new Set<string>() };
  for (const a of anticipos) {
    if (a.tipo_receptor === "compania") receptorIds.compania.add(a.receptor_id);
    else receptorIds.desarmadero.add(a.receptor_id);
  }
  const [{ data: aseguradorasAnt }, { data: desarmaderosAnt }] = await Promise.all([
    receptorIds.compania.size > 0
      ? supabase.from("aseguradoras").select("id, nombre").in("id", Array.from(receptorIds.compania))
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    receptorIds.desarmadero.size > 0
      ? supabase.from("desarmaderos").select("id, nombre").in("id", Array.from(receptorIds.desarmadero))
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] })
  ]);
  const nombreTercero = (tipo: string, id: string) =>
    (tipo === "compania" ? aseguradorasAnt : desarmaderosAnt)?.find((x) => x.id === id)?.nombre ?? "—";

  let queryGenerales = supabase
    .from("movimientos_generales")
    .select("*, caja:cajas(*), cuenta_contable:cuentas_contables(*)")
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true });
  if (filtros.caja_id) queryGenerales = queryGenerales.eq("caja_id", filtros.caja_id);
  if (filtros.cuenta_contable_id)
    queryGenerales = queryGenerales.eq("cuenta_contable_id", filtros.cuenta_contable_id);
  if (filtros.desde) queryGenerales = queryGenerales.gte("fecha", filtros.desde);
  if (filtros.hasta) queryGenerales = queryGenerales.lte("fecha", filtros.hasta);
  const { data: generalesRaw } = await queryGenerales;
  const generales = (generalesRaw ?? []) as unknown as MovimientoGeneral[];

  const filasCaso: FilaLibro[] = movimientos.map((m) => ({
    key: `caso-${m.id}`,
    fecha: m.fecha,
    casoHref: `/casos/${m.caso_id}`,
    casoLabel: m.caso?.vehiculo?.dominio ?? m.caso?.numero_siniestro ?? "—",
    descripcion: m.concepto?.nombre ?? "—",
    cuentaCodigo: m.cuenta_contable?.codigo ?? null,
    cajaNombre: m.caja?.nombre ?? null,
    centroDeCosto: m.caso?.aseguradora?.nombre ?? "—",
    tipo: "egreso",
    monto: m.monto
  }));
  const filasCobros: FilaLibro[] = cobros.map((c) => ({
    key: `cobro-${c.id}`,
    fecha: c.fecha,
    casoHref: `/casos/${c.factura.caso_id}`,
    casoLabel: c.factura.caso?.vehiculo?.dominio ?? c.factura.caso?.numero_siniestro ?? "—",
    descripcion: `Cobro${c.factura.tipo_receptor === "desarmadero" ? " (desarmadero)" : " (compañía)"}${
      c.medio_pago ? ` — ${c.medio_pago}` : ""
    }`,
    cuentaCodigo: c.cuenta_contable?.codigo ?? null,
    cajaNombre: c.caja?.nombre ?? null,
    centroDeCosto: c.factura.caso?.aseguradora?.nombre ?? "—",
    tipo: "ingreso",
    monto: c.monto
  }));
  const filasAnticipos: FilaLibro[] = anticipos.map((a) => ({
    key: `anticipo-${a.id}`,
    fecha: a.fecha,
    casoHref: null,
    casoLabel: null,
    descripcion: `Anticipo recibido${a.observacion ? ` — ${a.observacion}` : ""}`,
    cuentaCodigo: a.cuenta_contable?.codigo ?? null,
    cajaNombre: a.caja?.nombre ?? null,
    centroDeCosto: nombreTercero(a.tipo_receptor, a.receptor_id),
    tipo: "ingreso",
    monto: a.monto
  }));
  const filasGenerales: FilaLibro[] = filtros.aseguradora_id
    ? []
    : generales.map((m) => ({
        key: `general-${m.id}`,
        fecha: m.fecha,
        casoHref: null,
        casoLabel: null,
        descripcion: m.descripcion,
        cuentaCodigo: m.cuenta_contable?.codigo ?? null,
        cajaNombre: m.caja?.nombre ?? null,
        centroDeCosto: "Administración general",
        tipo: m.tipo,
        monto: m.monto
      }));

  const filasUnificadas = [...filasCaso, ...filasCobros, ...filasAnticipos, ...filasGenerales].sort(
    (a, b) => a.fecha.localeCompare(b.fecha)
  );

  let saldo = 0;
  const filas = filasUnificadas.map((f) => {
    const importe = f.tipo === "egreso" ? -f.monto : f.monto;
    saldo += importe;
    return { f, importe, saldo };
  });

  const entradas = filasUnificadas
    .filter((f) => f.tipo === "ingreso")
    .reduce((a, f) => a + f.monto, 0);
  const salidas = filasUnificadas
    .filter((f) => f.tipo === "egreso")
    .reduce((a, f) => a + f.monto, 0);

  return { filasUnificadas, filas, entradas, salidas };
}
