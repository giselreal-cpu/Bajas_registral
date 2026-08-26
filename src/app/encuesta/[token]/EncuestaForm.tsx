"use client";

import { useState } from "react";
import { responderEncuesta } from "./actions";

const PREGUNTAS = [
  {
    key: "calificacionContacto" as const,
    texto: "¿La información que recibiste en el primer contacto fue clara y completa?"
  },
  {
    key: "calificacionTraslado" as const,
    texto: "¿Cómo calificarías la atención y puntualidad durante el traslado de tu vehículo?"
  },
  {
    key: "calificacionGestoria" as const,
    texto: "¿Qué tan conforme estás con el asesoramiento y acompañamiento de la gestoría durante todo el trámite?"
  }
];

type Calificaciones = Record<(typeof PREGUNTAS)[number]["key"], number>;

export default function EncuestaForm({ token }: { token: string }) {
  const [calificaciones, setCalificaciones] = useState<Partial<Calificaciones>>({});
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);

    if (PREGUNTAS.some((p) => !calificaciones[p.key])) {
      setMensaje({ tipo: "error", texto: "Completá las 3 calificaciones." });
      return;
    }

    setSaving(true);
    const resultado = await responderEncuesta(token, {
      calificacionContacto: calificaciones.calificacionContacto!,
      calificacionTraslado: calificaciones.calificacionTraslado!,
      calificacionGestoria: calificaciones.calificacionGestoria!,
      comentario
    });
    setSaving(false);

    if (resultado.error) {
      setMensaje({ tipo: "error", texto: resultado.error });
    } else {
      setEnviado(true);
    }
  }

  if (enviado) {
    return (
      <div className="text-center py-8">
        <p className="text-lg font-medium text-slate-900 mb-1">¡Gracias por tu respuesta!</p>
        <p className="text-sm text-slate-500">Tu opinión nos ayuda a mejorar.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {PREGUNTAS.map((p) => (
        <div key={p.key}>
          <label className="label">{p.texto}</label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3, 4, 5].map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setCalificaciones((c) => ({ ...c, [p.key]: valor }))}
                className={`w-10 h-10 rounded-md border text-sm font-medium ${
                  calificaciones[p.key] === valor
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {valor}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <label className="label">¿Algo que quieras contarnos para ayudarnos a mejorar? (opcional)</label>
        <textarea
          className="input"
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </div>
      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
          {mensaje.texto}
        </p>
      )}
      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? "Enviando..." : "Enviar respuesta"}
      </button>
    </form>
  );
}
