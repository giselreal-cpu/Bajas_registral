"use client";

import CatalogTable from "@/components/catalogos/CatalogTable";

export default function UsuariosPage() {
  return (
    <CatalogTable
      title="Usuarios"
      description="Personas del equipo que pueden ser responsables de un caso."
      endpoint="/api/usuarios"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "email", label: "Email" }
      ]}
    />
  );
}
