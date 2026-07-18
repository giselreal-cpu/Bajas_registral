"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Aseguradora, TipoBaja, Usuario } from "@/types/database";

interface Catalogos {
  aseguradoras: Aseguradora[];
  tipos_baja: TipoBaja[];
  usuarios: Usuario[];
}

export default function CasoForm() {
  const router = useRouter();
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    numero_siniestro: "",
    aseguradora_id: "",
    tipo_baja_id: "",
    responsable_id: "",
    observaciones: "",
    asegurado_nombre: "",
    asegurado_dni: "",
    asegurado_telefono: "",
    asegurado_email: "",
    vehiculo_dominio: "",
    vehiculo_marca: "",
    vehiculo_modelo: "",
    vehiculo_anio: ""
  });

  useEffect(() => {
    fetch("/api/catalogos")
      .then((r) => r.json())
      .then((data) => setCatalogos(data))
      .catch(() => setError("No se pudieron cargar los catálogos."));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      numero_siniestro: form.numero_siniestro,
      aseguradora_id: form.aseguradora_id,
      tipo_baja_id: form.tipo_baja_id || null,
      responsable_id: form.responsable_id || null,
      observaciones: form.observaciones || null,
      asegurado: {
        nombre: form.asegurado_nombre,
        dni: form.asegurado_dni || null,
        telefono: form.asegurado_telefono || null,
        email: form.asegurado_email || null
      },
      vehiculo: {
        dominio: form.vehiculo_dominio.toUpperCase(),
        marca: form.vehiculo_marca || null,
        modelo: form.vehiculo_modelo || null,
        anio: form.vehiculo_anio ? Number(form.vehiculo_anio) : null
      }
    };

    const res = await fetch("/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Ocurrió un error al crear el caso.");
      return;
    }

    router.push(`/casos/${json.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="card p-3 text-sm text-red-600 border-red-200 bg-red-50">
          {error}
        </div>
      )}

      <section className="card p-4 space-y-4">
        <h2 className="font-medium text-slate-800">Datos del caso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">N° de siniestro *</label>
            <input
              required
              className="input"
              value={form.numero_siniestro}
              onChange={(e) => update("numero_siniestro", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Aseguradora *</label>
            <select
              required
              className="input"
              value={form.aseguradora_id}
              onChange={(e) => update("aseguradora_id", e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {catalogos?.aseguradoras.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo de baja</label>
            <select
              className="input"
              value={form.tipo_baja_id}
              onChange={(e) => update("tipo_baja_id", e.target.value)}
            >
              <option value="">Sin definir</option>
              {catalogos?.tipos_baja.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Responsable</label>
            <select
              className="input"
              value={form.responsable_id}
              onChange={(e) => update("responsable_id", e.target.value)}
            >
              <option value="">Sin asignar</option>
              {catalogos?.usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Observaciones</label>
          <textarea
            className="input"
            rows={2}
            value={form.observaciones}
            onChange={(e) => update("observaciones", e.target.value)}
          />
        </div>
      </section>

      <section className="card p-4 space-y-4">
        <h2 className="font-medium text-slate-800">Asegurado / titular</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre *</label>
            <input
              required
              className="input"
              value={form.asegurado_nombre}
              onChange={(e) => update("asegurado_nombre", e.target.value)}
            />
          </div>
          <div>
            <label className="label">DNI</label>
            <input
              className="input"
              value={form.asegurado_dni}
              onChange={(e) => update("asegurado_dni", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input
              className="input"
              value={form.asegurado_telefono}
              onChange={(e) => update("asegurado_telefono", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.asegurado_email}
              onChange={(e) => update("asegurado_email", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card p-4 space-y-4">
        <h2 className="font-medium text-slate-800">Vehículo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dominio *</label>
            <input
              required
              className="input uppercase"
              value={form.vehiculo_dominio}
              onChange={(e) => update("vehiculo_dominio", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Año</label>
            <input
              className="input"
              type="number"
              value={form.vehiculo_anio}
              onChange={(e) => update("vehiculo_anio", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Marca</label>
            <input
              className="input"
              value={form.vehiculo_marca}
              onChange={(e) => update("vehiculo_marca", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Modelo</label>
            <input
              className="input"
              value={form.vehiculo_modelo}
              onChange={(e) => update("vehiculo_modelo", e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Guardando..." : "Crear caso"}
        </button>
      </div>
    </form>
  );
}
