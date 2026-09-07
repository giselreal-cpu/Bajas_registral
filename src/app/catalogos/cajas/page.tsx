"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";
import { MONEDAS, TIPOS_CAJA } from "@/types/database";

export default function CajasPage() {
  return (
    <CatalogTable
      title="Cajas"
      description="Medios de efectivo reales: caja física, cuenta bancaria, billetera virtual, fondo fijo, financiera, caja de seguridad."
      endpoint="/api/cajas"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        {
          key: "tipo",
          label: "Tipo",
          required: true,
          type: "select",
          options: TIPOS_CAJA
        },
        {
          key: "moneda",
          label: "Moneda",
          required: true,
          type: "select",
          options: MONEDAS
        }
      ]}
    />
  );
}
