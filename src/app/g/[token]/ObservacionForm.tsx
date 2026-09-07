"use client";

import { useRef, useState } from "react";
import { agregarObservacionGestor } from "./actions";

export default function ObservacionForm({ token }: { token: string }) {
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMensaje(null);

    const formData = new FormData(e.currentTarget);
    const texto = String(formData.get("texto") ?? "");
    const resultado = await agregarObservacionGestor(token, texto);
    setSaving(false);

    if (resultado.error) {
      setMensaje({ tipo: "error", texto: resultado.error });
    } else {
      setMensaje({ tipo: "ok", texto: "Observación cargada correctamente." });
      formRef.current?.reset();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <textarea
          required
          name="texto"
          rows={3}
          placeholder="Ej.: turno en el registro para el 04/09 a las 10:30"
          className="mv-input"
          style={{ resize: "none" }}
        />
      </div>
      {mensaje && (
        <p
          className="text-sm"
          style={{ color: mensaje.tipo === "ok" ? "var(--mv-accent-700)" : "#b42318" }}
        >
          {mensaje.texto}
        </p>
      )}
      <button
        className="mv-btn mv-btn-primary w-full disabled:opacity-50"
        style={{ minHeight: 48 }}
        disabled={saving}
        type="submit"
      >
        {saving ? "Guardando..." : "Agregar observación"}
      </button>
    </form>
  );
}
