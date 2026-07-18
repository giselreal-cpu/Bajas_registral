"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function AseguradorasPage() {
  return (
    <CatalogTable
      title="Aseguradoras"
      description="Compañías de seguro que piden las bajas registrales."
      endpoint="/api/aseguradoras"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "cuit", label: "CUIT" },
        { key: "contacto", label: "Contacto" },
        { key: "email", label: "Email" },
        { key: "telefono", label: "Teléfono" }
      ]}
    />
  );
}
