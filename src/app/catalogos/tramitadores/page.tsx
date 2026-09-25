"use client";

import { useEffect, useState } from "react";
import CatalogTable from "@/components/catalogos/CatalogTable";

export default function TramitadoresPage() {
  const [aseguradoras, setAseguradoras] = useState<{ value: string; label: string }[] | null>(null);

  useEffect(() => {
    fetch("/api/aseguradoras")
      .then((r) => r.json())
      .then((json) =>
        setAseguradoras(
          (json.data ?? []).map((a: { id: string; nombre: string }) => ({ value: a.id, label: a.nombre }))
        )
      )
      .catch(() => setAseguradoras([]));
  }, []);

  if (!aseguradoras) return <p className="text-sm text-slate-500">Cargando...</p>;

  return (
    <CatalogTable
      title="Trámitadores"
      description="Personas de cada compañía que gestionan el caso de su lado. Al cargar un caso se elige de la lista de la compañía (o se agrega ahí mismo); acá se pueden corregir o reasignar."
      endpoint="/api/tramitadores"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        { key: "email", label: "Email" },
        { key: "aseguradora_id", label: "Compañía", type: "select", options: aseguradoras, required: true }
      ]}
    />
  );
}
