import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { calcularCierre } from "@/lib/cierreMensual";
import { obtenerDatosCierre } from "@/lib/cierreMensualDatos";

function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [a, m] = desde.split("-").map(Number);
  const [fa, fm] = hasta.split("-").map(Number);
  while (a < fa || (a === fa && m <= fm)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return out;
}

// GET /api/cierre-mensual/export-rango?desde=AAAA-MM&hasta=AAAA-MM
// Un renglón por mes con los indicadores del cierre, para comparar períodos.
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.rol === "compania") {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }
  const desde = request.nextUrl.searchParams.get("desde") ?? "";
  const hasta = request.nextUrl.searchParams.get("hasta") ?? "";
  if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta) || desde > hasta) {
    return NextResponse.json({ error: "Elegí un rango de meses válido (desde ≤ hasta)." }, { status: 400 });
  }
  const meses = mesesEntre(desde, hasta);
  if (meses.length > 36) {
    return NextResponse.json({ error: "El rango no puede superar 36 meses." }, { status: 400 });
  }

  const supabase = createClient() as unknown as SupabaseClient;
  const datos = await obtenerDatosCierre(supabase);
  const filas = meses.map((m) => calcularCierre(m, datos));
  const hoy = new Date().toISOString().slice(0, 10);
  const nombre = `cierre_${desde}_a_${hasta}_generado_${hoy}`;

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Comparativo");
  hoja.columns = [
    { header: "Mes", key: "mes", width: 10 },
    { header: "A1 Cobrado en el mes", key: "a1", width: 18 },
    { header: "A2 Pendiente de cobro", key: "a2", width: 18 },
    { header: "Otros ajustes de ingresos (A3+A4)", key: "aj", width: 22 },
    { header: "Ingresos", key: "ing", width: 17 },
    { header: "B1 Pagado en el mes", key: "b1", width: 18 },
    { header: "B2 Pendiente de pago", key: "b2", width: 18 },
    { header: "Otros ajustes de egresos (B3)", key: "ajb", width: 22 },
    { header: "Egresos", key: "egr", width: 17 },
    { header: "Ganancia", key: "gan", width: 17 },
    { header: "ROI %", key: "roi", width: 10 },
    { header: "Margen %", key: "mar", width: 10 },
    { header: "C1 Cobranzas anteriores", key: "c1", width: 20 },
    { header: "C2 Pagos anteriores", key: "c2", width: 18 },
    { header: "Saldo de cajas", key: "saldo", width: 18 },
    { header: "Bancos", key: "ban", width: 16 },
    { header: "Efectivo", key: "efe", width: 16 }
  ];
  const cab = hoja.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  filas.forEach((r, i) => {
    const n = i + 2;
    hoja.addRow({
      mes: r.mes,
      a1: r.A1_cobrado_mes,
      a2: r.A2_pendiente_cierre,
      aj: r.A3_cobrado_antes + r.A4_notas_credito_anteriores,
      ing: { formula: `B${n}+C${n}+D${n}`, result: r.ingresos },
      b1: r.B1_pagado_mes,
      b2: r.B2_pendiente_cierre,
      ajb: r.B3_pagado_antes,
      egr: { formula: `F${n}+G${n}+H${n}`, result: r.egresos },
      gan: { formula: `E${n}-I${n}`, result: r.ganancia },
      roi: { formula: `IF(I${n}=0,"N/A",ROUND(J${n}/I${n}*100,2))`, result: r.roi ?? "N/A" },
      mar: { formula: `IF(E${n}=0,"N/A",ROUND(J${n}/E${n}*100,2))`, result: r.margen ?? "N/A" },
      c1: r.C1_cobranzas_anteriores,
      c2: r.C2_pagos_anteriores,
      saldo: r.saldo_cajas_total,
      ban: r.saldo_bancos,
      efe: r.saldo_efectivo
    });
  });
  for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "M", "N", "O", "P", "Q"]) {
    hoja.getColumn(col).numFmt = "#,##0.00;[Red]-#,##0.00";
  }

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`
    }
  });
}
