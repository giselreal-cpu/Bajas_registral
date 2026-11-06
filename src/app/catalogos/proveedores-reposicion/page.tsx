"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function ProveedoresReposicionPage() {
  return (
    <CatalogTable
      title="Proveedores de reposición"
      description="Proveedores de la compañía que gestionan la reposición de la unidad y necesitan seguir cómo va la baja. Si tienen más de un contacto, cargá los mails separados por coma."
      endpoint="/api/proveedores-reposicion"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "emails", label: "Mails de contacto (separados por coma)" },
        { key: "telefono", label: "Teléfono" }
      ]}
    />
  );
}
