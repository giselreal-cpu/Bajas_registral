"use client";

import { useRef, useState } from "react";
import { subirDocumentoFormularioBaja } from "./actions";

export default function UploadForm({ token }: { token: string }) {
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMensaje(null);

    const formData = new FormData(e.currentTarget);
    try {
      const resultado = await subirDocumentoFormularioBaja(token, formData);
      if (resultado.error) {
        setMensaje({ tipo: "error", texto: resultado.error });
      } else {
        setMensaje({ tipo: "ok", texto: "Archivo cargado correctamente." });
        formRef.current?.reset();
      }
    } catch {
      setMensaje({
        tipo: "error",
        texto: "No se pudo subir el archivo. Probá con uno más liviano o revisá tu conexión."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Archivo *</label>
        <input
          required
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="input"
        />
      </div>
      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
          {mensaje.texto}
        </p>
      )}
      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? "Subiendo..." : "Subir archivo"}
      </button>
    </form>
  );
}
