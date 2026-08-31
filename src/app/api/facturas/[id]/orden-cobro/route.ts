import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarOrdenCobroDesarmadero } from "@/lib/documentos/ordenCobroDesarmadero";

// GET /api/facturas/[id]/orden-cobro -> PDF de "Orden de cobro" para una
// factura a desarmadero (fuera de alcance para facturas a compañía).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: factura, error: errorFactura } = await supabase
    .from("facturas")
    .select(
      `
      id, numero_factura, tipo_receptor, receptor_id, monto_total,
      fecha_emision, fecha_vencimiento, forma_pago,
      caso:casos(
        numero_siniestro,
        valor_infoauto,
        tipo_baja:tipos_baja(nombre),
        vehiculo:vehiculos(dominio, marca, modelo, anio)
      )
    `
    )
    .eq("id", params.id)
    .maybeSingle();

  if (errorFactura || !factura) {
    return NextResponse.json({ error: errorFactura?.message ?? "Factura no encontrada." }, { status: 404 });
  }

  if (factura.tipo_receptor !== "desarmadero") {
    return NextResponse.json(
      { error: "La orden de cobro solo está disponible para facturas a desarmadero." },
      { status: 400 }
    );
  }

  const [{ data: desarmadero }, { data: movimientos }] = await Promise.all([
    supabase.from("desarmaderos").select("nombre").eq("id", factura.receptor_id).maybeSingle(),
    supabase
      .from("movimientos_caso")
      .select("monto, concepto:conceptos_movimiento(nombre)")
      .eq("factura_id", params.id)
  ]);

  const movimientosFactura = (movimientos ?? []) as unknown as {
    monto: number;
    concepto: { nombre: string } | null;
  }[];

  const valorOtros = movimientosFactura
    .filter((m) => m.concepto?.nombre === "Otro")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const servicios = movimientosFactura.map((m) => ({
    concepto: m.concepto?.nombre ?? "Sin concepto",
    monto: Number(m.monto)
  }));

  const caso = factura.caso as unknown as {
    numero_siniestro: string;
    valor_infoauto: number | null;
    tipo_baja: { nombre: string } | null;
    vehiculo: { dominio: string; marca: string | null; modelo: string | null; anio: number | null } | null;
  } | null;

  const pdf = await generarOrdenCobroDesarmadero({
    numeroFactura: factura.numero_factura,
    numeroSiniestro: caso?.numero_siniestro ?? "—",
    fechaEmision: factura.fecha_emision,
    fechaVencimiento: factura.fecha_vencimiento,
    formaPago: factura.forma_pago,
    desarmaderoNombre: desarmadero?.nombre ?? "—",
    tipoBajaNombre: caso?.tipo_baja?.nombre ?? null,
    vehiculoDominio: caso?.vehiculo?.dominio ?? "—",
    vehiculoMarca: caso?.vehiculo?.marca ?? null,
    vehiculoModelo: caso?.vehiculo?.modelo ?? null,
    vehiculoAnio: caso?.vehiculo?.anio ?? null,
    servicios,
    valorMercado: caso?.valor_infoauto ?? null,
    valorOtros,
    total: factura.monto_total
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orden-cobro-N${factura.numero_factura}.pdf"`
    }
  });
}
