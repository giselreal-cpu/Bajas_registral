"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function GestoresPage() {
  return (
    <CatalogTable
      title="Gestores"
      description="Personas externas que gestionan trámites en el territorio (turnos, recibos) y pueden recibir un enlace para cargar archivos de un caso."
      endpoint="/api/gestores"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "contacto", label: "Contacto" }
      ]}
    />
  );
}
