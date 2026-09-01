"use client";

import { useRef, useState } from "react";
import { CATEGORIAS_GESTOR, CategoriaDocumento } from "@/types/database";
import { iniciarSubidaGestor, confirmarSubidaGestor } from "./actions";
import { subirArchivoDirecto } from "@/lib/uploadArchivoDirecto";

export default function UploadForm({ token }: { token: string }) {
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMensaje(null);

    const formData = new FormData(e.currentTarget);
    const categoria = formData.get("categoria") as CategoriaDocumento;
    const file = formData.get("file") as File;

    try {
      const inicio = await iniciarSubidaGestor(token, categoria, file.name, file.size, file.type);
      if (inicio.error || !inicio.path || !inicio.uploadToken) {
        setMensaje({ tipo: "error", texto: inicio.error ?? "No se pudo iniciar la subida." });
        return;
      }

      await subirArchivoDirecto(inicio.path, inicio.uploadToken, file);

      const resultado = await confirmarSubidaGestor(token, categoria, file.name, inicio.path);
      if (resultado.error) {
        setMensaje({ tipo: "error", texto: resultado.error });
      } else {
        setMensaje({ tipo: "ok", texto: "Archivo cargado correctamente." });
        formRef.current?.reset();
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo subir el archivo. Revisá tu conexión."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Categoría</label>
        <select name="categoria" className="input" defaultValue={CATEGORIAS_GESTOR[0].value}>
          {CATEGORIAS_GESTOR.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
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
