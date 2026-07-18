"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function DesarmaderosPage() {
  return (
    <CatalogTable
      title="Desarmaderos"
      description="Empresas que compran/reciben el vehículo siniestrado para desguace."
      endpoint="/api/desarmaderos"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "cuit", label: "CUIT" },
        { key: "contacto", label: "Contacto" },
        { key: "direccion", label: "Dirección" }
      ]}
    />
  );
}
