"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Caja, ConceptoMovimiento } from "@/types/database";
import { subirArchivoDirecto } from "@/lib/uploadArchivoDirecto";

interface CasoOpcion {
  id: string;
  numero_siniestro: string;
  vehiculo: { dominio: string } | null;
  aseguradora: { nombre: string } | null;
}

interface Props {
  casos: CasoOpcion[];
  conceptos: ConceptoMovimiento[];
  cajas: Caja[];
  cajaPreseleccionadaId: string | null;
}

export default function RegistrarGastoForm({ casos, conceptos, cajas, cajaPreseleccionadaId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [casoId, setCasoId] = useState(casos[0]?.id ?? "");
  const [conceptoId, setConceptoId] = useState("");
  const [monto, setMonto] = useState("");
  const [cajaId, setCajaId] = useState(cajaPreseleccionadaId ?? "");
  const [cuentaContableId, setCuentaContableId] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const concepto = conceptos.find((c) => c.id === conceptoId);
  const cajaElegida = cajas.find((c) => c.id === cajaId);

  function elegirConcepto(id: string) {
    setConceptoId(id);
    const c = conceptos.find((x) => x.id === id);
    setCuentaContableId(c?.cuenta_contable_id ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!casoId || !conceptoId || !monto) {
      setError("Elegí el caso, el concepto y cargá un importe.");
      return;
    }
    setSaving(true);
    try {
      let documento_id: string | null = null;

      if (comprobante) {
        const metaRes = await fetch(`/api/casos/${casoId}/documentos/subida-firmada`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoria: "comprobante_gasto",
            nombre: comprobante.name,
            size: comprobante.size,
            type: comprobante.type
          })
        });
        const metaJson = await metaRes.json();
        if (!metaRes.ok) {
          setError(metaJson.error ?? "No se pudo iniciar la subida del comprobante.");
          return;
        }
        await subirArchivoDirecto(metaJson.data.path, metaJson.data.token, comprobante);

        const docRes = await fetch(`/api/casos/${casoId}/documentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoria: "comprobante_gasto",
            nombre: comprobante.name,
            path: metaJson.data.path
          })
        });
        const docJson = await docRes.json();
        if (!docRes.ok) {
          setError(docJson.error ?? "No se pudo registrar el comprobante.");
          return;
        }
        documento_id = docJson.data.id;
      }

      const res = await fetch(`/api/casos/${casoId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concepto_id: conceptoId,
          monto: Number(monto),
          caja_id: cajaId || null,
          cuenta_contable_id: cuentaContableId || null,
          documento_id,
          aprobado: false
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar el gasto.");
        return;
      }
      router.push("/caja");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mv -mx-4 px-4 pb-6" style={{ background: "var(--mv-bg)" }}>
      <div className="pt-1 pb-4">
        <h1 className="mv-heading text-lg">Registrar gasto</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--mv-neutral-600)" }}>
          Se carga como pendiente de aprobar y no impacta el resultado del caso hasta que se
          apruebe.
        </p>
      </div>

      {error && (
        <div
          className="mb-3 text-sm rounded-md p-3"
          style={{ color: "var(--mv-accent-700)", background: "var(--mv-accent-100)" }}
        >
          {error}
        </div>
      )}

      <div className="mv-label mb-1.5">Caso</div>
      <select
        className="mv-input"
        value={casoId}
        onChange={(e) => setCasoId(e.target.value)}
      >
        {casos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.vehiculo?.dominio ?? c.numero_siniestro} · {c.aseguradora?.nombre ?? "—"}
          </option>
        ))}
      </select>

      <div className="mv-label mt-4 mb-1.5">Concepto</div>
      <select className="mv-input" value={conceptoId} onChange={(e) => elegirConcepto(e.target.value)}>
        <option value="">Seleccionar...</option>
        {conceptos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <div className="mv-label mt-4 mb-1.5">Importe</div>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        className="mv-input"
        style={{ fontFamily: "var(--mv-font-heading)", fontSize: 22 }}
        placeholder="$ 0"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />

      <div className="flex items-baseline justify-between mt-4 mb-2">
        <span className="mv-label">Caja</span>
        <span className="text-[11px]" style={{ color: "var(--mv-neutral-600)" }}>
          La que más usás
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {cajas.map((c) => {
          const activo = c.id === cajaId;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => setCajaId(c.id)}
              className="mv-heading text-[13px]"
              style={{
                minHeight: 38,
                padding: "8px 13px",
                borderRadius: 99,
                border: `1px solid ${activo ? "var(--mv-accent)" : "var(--mv-divider)"}`,
                background: activo ? "rgba(182,130,53,0.14)" : "transparent",
                color: activo ? "var(--mv-accent-700)" : "var(--mv-neutral-700)"
              }}
            >
              {c.nombre}
            </button>
          );
        })}
      </div>

      {concepto?.cuenta_contable && (
        <div className="mt-4" style={{ borderLeft: "2px solid var(--mv-accent)", paddingLeft: 14 }}>
          <div className="mv-label">Cuenta contable sugerida</div>
          <div
            className="mt-1"
            style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13.5, fontWeight: 600, color: "var(--mv-accent-700)" }}
          >
            {concepto.cuenta_contable.codigo} · {concepto.cuenta_contable.nombre}
          </div>
        </div>
      )}

      <div className="mv-label mt-4 mb-1.5">Comprobante (opcional)</div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mv-card w-full text-left px-3.5 py-3 text-sm"
        style={{ color: comprobante ? "var(--mv-text)" : "var(--mv-neutral-600)" }}
      >
        {comprobante ? comprobante.name : "Sacar foto del comprobante"}
      </button>

      <button
        type="submit"
        disabled={saving}
        className="mv-btn mv-btn-primary w-full mt-6 disabled:opacity-50"
        style={{ minHeight: 50, fontSize: 15 }}
      >
        {saving ? "Guardando..." : "Guardar gasto"}
      </button>
      <p className="text-[11.5px] mt-2.5 text-center" style={{ color: "var(--mv-neutral-600)" }}>
        Impacta en la liquidez de «{cajaElegida?.nombre ?? "sin caja asignada"}» una vez aprobado.
      </p>
    </form>
  );
}
