"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function TiposBajaPage() {
  return (
    <CatalogTable
      title="Tipos de baja"
      description="Catálogo abierto: 04D, 04C, 04 Digital, Baja por robo, etc."
      endpoint="/api/tipos-baja"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "descripcion", label: "Descripción", type: "textarea" }
      ]}
    />
  );
}
