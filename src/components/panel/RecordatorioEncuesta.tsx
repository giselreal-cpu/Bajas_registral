"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { linkWhatsapp, mensajeEncuesta } from "@/lib/whatsapp";

interface Props {
  encuestaId: string;
  token: string;
  asegurado: string;
  telefono: string | null;
  dominio: string;
  numeroSiniestro: string;
}

// Botón "Reenviar recordatorio": bumpea ultimo_contacto_at (reinicia el
// conteo de 48hs hábiles) y muestra la caja de WhatsApp para reenviar el
// mismo mensaje de encuesta.
export default function RecordatorioEncuesta({
  encuestaId,
  token,
  asegurado,
  telefono,
  dominio,
  numeroSiniestro
}: Props) {
  const router = useRouter();
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function reenviar() {
    setSaving(true);
    try {
      const res = await fetch(`/api/encuestas/${encuestaId}/recordatorio`, { method: "POST" });
      if (res.ok) {
        setEnviado(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!enviado) {
    return (
      <button
        type="button"
        className="btn-secondary text-xs"
        onClick={reenviar}
        disabled={saving}
      >
        {saving ? "..." : "Reenviar recordatorio"}
      </button>
    );
  }

  const enlace = `${origin}/encuesta/${token}`;
  const mensaje = mensajeEncuesta({ asegurado, dominio, numeroSiniestro }, enlace);
  const link = linkWhatsapp(telefono, mensaje);

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-2 mt-2">
      <p className="text-slate-700 whitespace-pre-wrap">{mensaje}</p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-secondary text-xs" onClick={copiar}>
          {copiado ? "¡Copiado!" : "Copiar mensaje"}
        </button>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
            Abrir WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
