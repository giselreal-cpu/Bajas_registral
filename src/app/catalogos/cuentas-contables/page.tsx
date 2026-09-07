"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function CuentasContablesPage() {
  return (
    <CatalogTable
      title="Cuentas contables"
      description="Catálogo de cuentas para clasificar los movimientos de cada caso (ej: 5.1.1 Traslados y grúas)."
      endpoint="/api/cuentas-contables"
      columns={[
        { key: "codigo", label: "Código", required: true },
        { key: "codigo_padre", label: "Código padre" },
        { key: "nombre", label: "Nombre", required: true },
        {
          key: "tipo",
          label: "Tipo",
          required: true,
          type: "select",
          options: [
            { value: "activo", label: "Activo" },
            { value: "pasivo", label: "Pasivo" },
            { value: "pn", label: "Patrimonio neto" },
            { value: "ingreso", label: "Ingreso" },
            { value: "egreso", label: "Egreso" }
          ]
        }
      ]}
    />
  );
}
