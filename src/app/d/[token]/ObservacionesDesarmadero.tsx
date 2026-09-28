"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { agregarObservacionDesarmadero } from "./actions";

export interface ObservacionRow {
  id: string;
  fecha_inicio: string;
  observacion: string;
}

// Separa el prefijo "Autor: X\n" (si está) del resto del texto, para
// mostrarlo como una etiqueta chica en vez de mezclado con el mensaje.
function separarAutor(texto: string): { autor: string | null; texto: string } {
  const m = texto.match(/^Autor: (.+?)\n([\s\S]*)$/);
  if (!m) return { autor: null, texto };
  return { autor: m[1], texto: m[2] };
}

export default function ObservacionesDesarmadero({
  token,
  observaciones
}: {
  token: string;
  observaciones: ObservacionRow[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const resultado = await agregarObservacionDesarmadero(token, texto);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setTexto("");
    router.refresh();
  }

  return (
    <section className="card p-4">
      <h2 className="font-medium text-slate-800 mb-1">Observaciones</h2>
      <p className="text-xs text-slate-400 mb-3">
        Es un canal directo con Oltra: lo que cargues acá lo ven ustedes y nuestro equipo, nadie
        más.
      </p>

      <form onSubmit={enviar} className="space-y-2 mb-4">
        <textarea
          className="input"
          rows={3}
          placeholder="Escribí una observación sobre este caso..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary" disabled={guardando || !texto.trim()}>
          {guardando ? "Guardando..." : "Agregar observación"}
        </button>
      </form>

      {observaciones.length === 0 ? (
        <p className="text-sm text-slate-400">Todavía no hay observaciones cargadas.</p>
      ) : (
        <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {observaciones.map((ev) => {
            const { autor, texto: textoLimpio } = separarAutor(ev.observacion);
            return (
              <li key={ev.id} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  {autor && <span className="text-xs font-medium text-slate-500">{autor}</span>}
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(ev.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR")}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{textoLimpio}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
