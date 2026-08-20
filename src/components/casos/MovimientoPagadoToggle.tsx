"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  movimientoId: string;
  pagado: boolean;
  onChange?: (pagado: boolean) => void;
}

// Toggle "Pagado" / "Pendiente de pago" para un movimiento de egreso. Se
// usa tanto dentro de la sección Rentabilidad de un caso (que ya tiene su
// propio estado y refresca por fetch) como en la página de seguimiento
// financiero (Server Component, que refresca con router.refresh()).
export default function MovimientoPagadoToggle({ movimientoId, pagado, onChange }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch(`/api/movimientos/${movimientoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagado: !pagado })
      });
      if (res.ok) {
        if (onChange) onChange(!pagado);
        else router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`badge ${pagado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
    >
      {pagado ? "Pagado" : "Pendiente"}
    </button>
  );
}
