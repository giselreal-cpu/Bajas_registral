import { describe, expect, it } from "vitest";
import { aFila } from "../exportCasos";

const mov = (nombre: string, tipo: string, extra: Record<string, unknown> = {}) => ({
  monto: 1000,
  moneda: "ARS",
  pagado: false,
  fecha: "2026-10-01",
  fecha_pago: null,
  anulado: false,
  aprobado: true,
  concepto: { nombre, tipo },
  ...extra
});

describe("aFila: columnas de cobros y pagos", () => {
  it("monto cargado y fecha solo si se efectuó el pago o el cobro", () => {
    const fila = aFila({
      numero_siniestro: "1",
      estado: "cerrado",
      movimientos_caso: [
        mov("Pago a la compañía", "egreso", { monto: 3000, pagado: true, fecha_pago: "2026-10-15" }),
        mov("Pago a la compañía", "egreso", { monto: 500, pagado: false }),
        mov("Honorarios por Gestoría", "egreso", { monto: 65000 }),
        mov("Cobro al desarmadero", "ingreso", { monto: 9000 }),
        mov("Cobro a la aseguradora", "ingreso", { monto: 700, anulado: true }),
        mov("Pago a la compañía", "egreso", { monto: 99, moneda: "USD", pagado: true, fecha_pago: "2026-10-20" })
      ],
      facturas: [
        { tipo_receptor: "desarmadero", cobros: [{ monto: 9000, moneda: "ARS", fecha: "2026-10-08", anulado: false }] },
        { tipo_receptor: "compania", cobros: [{ monto: 1, moneda: "ARS", fecha: "2026-10-09", anulado: true }] }
      ]
    });
    expect(fila.pago_compania_monto).toBe(3500); // en pesos, sin la de USD
    expect(fila.pago_compania_fecha).toBe("2026-10-15");
    expect(fila.pago_gestoria_monto).toBe(65000);
    expect(fila.pago_gestoria_fecha).toBe(""); // cargado, no pagado
    expect(fila.cobro_desarmadero_monto).toBe(9000);
    expect(fila.cobro_desarmadero_fecha).toBe("2026-10-08");
    expect(fila.cobro_compania_monto).toBe(""); // anulado: no cuenta
    expect(fila.cobro_compania_fecha).toBe("");
  });
});
