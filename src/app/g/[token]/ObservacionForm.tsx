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
        <label className="label">Observación *</label>
        <textarea required name="texto" rows={3} className="input" />
      </div>
      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
          {mensaje.texto}
        </p>
      )}
      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? "Guardando..." : "Agregar observación"}
      </button>
    </form>
  );
}
