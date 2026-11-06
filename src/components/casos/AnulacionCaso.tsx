"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Anulación de un caso que no avanza: queda con su número, su bitácora y sus
// movimientos, pero marcado como anulado con el motivo. Muestra el aviso del
// caso anulado y los botones para anular (equipo interno) o reactivar
// (administrador).
export default function AnulacionCaso({
  casoId,
  estado,
  anulado,
  motivo,
  anuladoAt,
  soloLectura,
  esAdministrador,
  mobile
}: {
  casoId: string;
  estado: string;
  anulado?: boolean;
  motivo?: string | null;
  anuladoAt?: string | null;
  soloLectura?: boolean;
  esAdministrador?: boolean;
  mobile?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function llamar(metodo: "POST" | "DELETE") {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${casoId}/anular`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: metodo === "POST" ? JSON.stringify({ motivo: texto }) : undefined
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "No se pudo completar la operación.");
        return;
      }
      setAbierto(false);
      setTexto("");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  if (anulado) {
    return (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-medium">
          Caso anulado
          {anuladoAt ? ` el ${new Date(anuladoAt).toLocaleDateString("es-AR")}` : ""}
        </p>
        {motivo && <p className="mt-0.5">Motivo: {motivo}</p>}
        <p className="mt-1 text-xs text-red-700">
          Conserva su número, su bitácora y sus movimientos; no cuenta como caso en curso.
        </p>
        {esAdministrador && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => {
              if (confirm("¿Reactivar este caso?")) llamar("DELETE");
            }}
            className="mt-2 text-xs underline disabled:opacity-50"
          >
            {guardando ? "Reactivando..." : "Reactivar caso"}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  if (soloLectura || estado === "cerrado") return null;

  return (
    <div className="mb-4">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={mobile ? "text-xs underline" : "text-sm text-slate-500 underline hover:text-red-700"}
          style={mobile ? { color: "var(--mv-neutral-600)" } : undefined}
        >
          Anular caso
        </button>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
          <p className="text-slate-600">
            Anular el caso lo deja registrado con el motivo, sin borrarlo ni saltear su número.
          </p>
          <textarea
            className={mobile ? "mv-input" : "input"}
            rows={2}
            placeholder="Motivo (ej.: el asegurado arregló por su cuenta)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={guardando || texto.trim().length < 3}
              onClick={() => llamar("POST")}
              className={mobile ? "mv-btn text-xs px-3 py-1.5" : "btn-primary text-xs"}
              style={mobile ? { border: "1px solid #c0392b", color: "#c0392b" } : undefined}
            >
              {guardando ? "Anulando..." : "Confirmar anulación"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setError(null);
              }}
              className={mobile ? "text-xs" : "btn-secondary text-xs"}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
