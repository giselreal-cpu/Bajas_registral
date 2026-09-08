import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { toCsv, csvResponse } from "@/lib/csv";

// GET /api/administracion/libro-import/plantilla -> CSV de ejemplo para
// la importación masiva, con las columnas esperadas y una fila de
// ejemplo de cada tipo (caso / general).
export async function GET() {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return new Response("Sin acceso.", { status: 403 });
  }

  const columnas = [
    { key: "tipo_registro", label: "tipo_registro" },
    { key: "fecha", label: "fecha" },
    { key: "numero_siniestro", label: "numero_siniestro" },
    { key: "concepto", label: "concepto" },
    { key: "descripcion", label: "descripcion" },
    { key: "tipo_general", label: "tipo_general" },
    { key: "monto", label: "monto" },
    { key: "caja", label: "caja" },
    { key: "cuenta_contable", label: "cuenta_contable" },
    { key: "pagado_o_cobrado", label: "pagado_o_cobrado" },
    { key: "receptor", label: "receptor" },
    { key: "observacion", label: "observacion" }
  ];

  const ejemplos = [
    {
      tipo_registro: "caso",
      fecha: "2026-09-01",
      numero_siniestro: "0000000000000",
      concepto: "Honorarios por Gestoría",
      descripcion: "",
      tipo_general: "",
      monto: "50000",
      caja: "Caja pesos",
      cuenta_contable: "",
      pagado_o_cobrado: "SI",
      receptor: "",
      observacion: "Ejemplo egreso por caso, ya pagado"
    },
    {
      tipo_registro: "caso",
      fecha: "2026-09-01",
      numero_siniestro: "0000000000000",
      concepto: "Cobro a la aseguradora",
      descripcion: "",
      tipo_general: "",
      monto: "150000",
      caja: "Caja pesos",
      cuenta_contable: "",
      pagado_o_cobrado: "SI",
      receptor: "compania",
      observacion: "Ejemplo ingreso por caso, ya cobrado a la compañía"
    },
    {
      tipo_registro: "general",
      fecha: "2026-09-01",
      numero_siniestro: "",
      concepto: "",
      descripcion: "Alquiler de oficina",
      tipo_general: "egreso",
      monto: "80000",
      caja: "Caja pesos",
      cuenta_contable: "",
      pagado_o_cobrado: "",
      receptor: "",
      observacion: ""
    }
  ];

  const csv = toCsv(ejemplos, columnas);
  return csvResponse(csv, "plantilla-importacion-movimientos.csv");
}
