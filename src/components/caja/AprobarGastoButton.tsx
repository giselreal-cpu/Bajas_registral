"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AprobarGastoButton({ movimientoId }: { movimientoId: string }) {
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
