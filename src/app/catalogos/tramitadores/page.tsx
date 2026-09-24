"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function TramitadoresPage() {
  return (
    <CatalogTable
      title="Trámitadores"
      description="Personas de la compañía que gestionan el caso de su lado. Se cargan solas al escribir un nombre nuevo en un caso, acá se pueden corregir o unificar."
      endpoint="/api/tramitadores"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "email", label: "Email" }
      ]}
    />
  );
}
