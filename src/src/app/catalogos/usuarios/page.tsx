"use client";

import { useEffect, useState } from "react";
import CatalogTable from "@/components/catalogos/CatalogTable";
import { ROLES } from "@/types/database";

export default function UsuariosPage() {
  const [aseguradoraOptions, setAseguradoraOptions] = useState<
    { value: string; label: string }[] | null
  >(null);

  useEffect(() => {
    fetch("/api/aseguradoras")
      .then((r) => r.json())
      .then((json) =>
        setAseguradoraOptions(
          (json.data ?? []).map((a: any) => ({ value: a.id, label: a.nombre }))
        )
      )
      .catch(() => setAseguradoraOptions([]));
  }, []);

  if (!aseguradoraOptions) {
    return <p className="text-sm text-slate-500">Cargando...</p>;
  }

  return (
    <div>
      <CatalogTable
        title="Usuarios"
        description={
          'Personas que pueden entrar al sistema. El rol "Compañía" solo ve los ' +
          "casos de la aseguradora que le asignes, sin observaciones internas."
        }
        endpoint="/api/usuarios"
        columns={[
          { key: "nombre", label: "Nombre", required: true },
          { key: "email", label: "Email" },
          {
            key: "rol",
            label: "Rol",
            required: true,
            type: "select",
            options: ROLES
          },
          {
            key: "aseguradora_id",
            label: "Aseguradora (solo rol Compañía)",
            type: "select",
            options: aseguradoraOptions
          },
          { key: "auth_user_id", label: "ID de cuenta (Supabase Auth)" }
        ]}
      />
      <p className="text-xs text-slate-400 mt-3">
        El campo "Aseguradora" solo tiene efecto para usuarios con rol
        "Compañía"; para "Operador" y "Administrador" se ignora.
      </p>
    </div>
  );
}
