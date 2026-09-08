"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  movimientoId: string;
  esAdministrador: boolean;
}

// Aprobar un gasto de campo mueve plata real (una vez aprobado, cuenta
// para Libro/Liquidez si además se marca pagado) — reservado a
// administrador, para que no sea la misma persona que cargó el gasto
// quien se lo autoaprueba.
export default function AprobarGastoButton({ movimientoId, esAdministrador }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function aprobar() {
    setSaving(true);
    try {
      const res = await fetch(`/api/movimientos/${movimientoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprobado: true })
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!esAdministrador) {
    return (
      <span
        className="mv-heading text-[13.5px] text-center"
        style={{ flex: 1, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mv-neutral-600)" }}
      >
        Pendiente — solo un administrador puede aprobar
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={aprobar}
      className="mv-heading text-[13.5px] disabled:opacity-50"
      style={{
        flex: 1,
        minHeight: 40,
        borderRadius: "var(--mv-radius-md)",
        border: "1px solid var(--mv-accent)",
        background: "transparent",
        color: "var(--mv-accent-700)"
      }}
    >
      {saving ? "Aprobando..." : "Aprobar"}
    </button>
  );
}
