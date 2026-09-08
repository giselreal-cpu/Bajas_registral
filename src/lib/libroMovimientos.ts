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

  const filasUnificadas = [...filasCaso, ...filasCobros, ...filasGenerales].sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
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
