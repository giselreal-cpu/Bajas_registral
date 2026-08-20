"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function ConceptosMovimientoPage() {
  return (
    <CatalogTable
      title="Conceptos de movimiento"
      description="Rubros de ingreso y egreso para la rentabilidad de cada caso."
      endpoint="/api/conceptos-movimiento"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        {
          key: "tipo",
          label: "Tipo",
          required: true,
          type: "select",
          options: [
            { value: "ingreso", label: "Ingreso" },
            { value: "egreso", label: "Egreso" }
          ]
        }
      ]}
    />
  );
}
