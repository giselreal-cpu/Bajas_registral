"use client";

import { useEffect, useState } from "react";
import CatalogTable from "@/components/catalogos/CatalogTable";
import { CuentaContable } from "@/types/database";

export default function ConceptosMovimientoPage() {
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);

  useEffect(() => {
    fetch("/api/cuentas-contables")
      .then((res) => res.json())
      .then((json) => setCuentas(json.data ?? []))
      .catch(() => {});
  }, []);

  return (
    <CatalogTable
      title="Conceptos de movimiento"
      description="Rubros de ingreso y egreso para la rentabilidad de cada caso. La cuenta contable es la que se sugiere al cargar un movimiento con este concepto — se puede corregir en el momento de la carga."
      endpoint="/api/conceptos-movimiento"
      columns={[
        { key: "nombre", label: "Nombre", required: true },
        {
          key: "tipo",
          label: "Tipo",
          required: true,
          type: "select",
          options: [
            { value: "ingreso", label: "Ingreso" },
            { value: "egreso", label: "Egreso" }
          ]
        },
        {
          key: "cuenta_contable_id",
          label: "Cuenta contable sugerida",
          type: "select",
          options: cuentas.map((c) => ({ value: c.id, label: `${c.codigo} · ${c.nombre}` }))
        }
      ]}
    />
  );
}
