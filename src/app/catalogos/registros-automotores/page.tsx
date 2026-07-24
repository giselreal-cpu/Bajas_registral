"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function RegistrosAutomotoresPage() {
  return (
    <CatalogTable
      title="Registros automotores"
      description="Oficinas de registro donde se tramita la baja física."
      endpoint="/api/registros-automotores"
      columns={[
        { key: "numero", label: "Número", required: true },
        { key: "seccional", label: "Denominación" },
        { key: "provincia", label: "Provincia" }
      ]}
    />
  );
}
