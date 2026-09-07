import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Aseguradora,
  CasoConRelaciones,
  Gestor,
  RegistroAutomotor,
  TipoBaja,
  Usuario
} from "@/types/database";

export interface CasoCabeceraProps {
  caso: CasoConRelaciones;
  aseguradoras: Aseguradora[];
  registros: RegistroAutomotor[];
  tiposBaja: TipoBaja[];
  usuarios: Usuario[];
  gestores: Gestor[];
  soloLectura?: boolean;
  esAdministrador?: boolean;
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// Toda la lógica de edición del caso (form, guardado, borrado, enlace de
// gestor) vive acá para que la vista de escritorio (CasoCabecera) y la de
// mobile (CasoCabeceraMobile) compartan el mismo comportamiento sin
// duplicarlo — solo cambia cómo se dibuja.
function formDesdeCaso(caso: CasoConRelaciones) {
  return {
    numero_siniestro: caso.numero_siniestro,
    vehiculo_dominio: caso.vehiculo?.dominio ?? "",
    vehiculo_marca: caso.vehiculo?.marca ?? "",
    vehiculo_modelo: caso.vehiculo?.modelo ?? "",
    vehiculo_anio: caso.vehiculo?.anio ?? "",
    numero_poliza: caso.numero_poliza ?? "",
    aseguradora_id: caso.aseguradora_id,
    rama: caso.rama ?? "",
    tipo_tramite: caso.tipo_tramite ?? "",
    registro_id: caso.registro_id ?? "",
    tipo_baja_id: caso.tipo_baja_id ?? "",
    responsable_id: caso.responsable_id ?? "",
    gestor_id: caso.gestor_id ?? "",
    deuda_patentes: caso.deuda_patentes ?? 0,
    deuda_multas: caso.deuda_multas ?? 0,
    suma_asegurada: caso.suma_asegurada ?? 0,
    valor_infoauto: caso.valor_infoauto ?? 0,
    fecha_cierre: caso.fecha_cierre ?? "",
    observaciones: caso.observaciones ?? "",
    productor_nombre: caso.productor_nombre ?? "",
    productor_contacto: caso.productor_contacto ?? "",
    tramitador_nombre: caso.tramitador_nombre ?? "",
    tramitador_email: caso.tramitador_email ?? "",
    asegurado_nombre: caso.asegurado?.nombre ?? "",
    asegurado_dni: caso.asegurado?.dni ?? "",
    asegurado_telefono: caso.asegurado?.telefono ?? "",
    asegurado_email: caso.asegurado?.email ?? "",
    asegurado_direccion: caso.asegurado?.direccion ?? "",
    asegurado_localidad: caso.asegurado?.localidad ?? "",
    asegurado_provincia: caso.asegurado?.provincia ?? "",
    asegurado_entre_calles: caso.asegurado?.entre_calles ?? "",
    asegurado_partido: caso.asegurado?.partido ?? ""
  };
}

export function useCasoCabecera({ caso, registros, soloLectura }: CasoCabeceraProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [notificarGestor, setNotificarGestor] = useState<CasoConRelaciones | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const [form, setForm] = useState(() => formDesdeCaso(caso));

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Si el caso cambió desde afuera mientras se estaba editando (por
  // ejemplo, se completó "Cierre de Caso" en la bitácora, que pone
  // fecha_cierre solo) — el formulario ya estaba abierto con una foto
  // vieja del caso, y "Guardar" pisaría ese cambio con el valor
  // desactualizado. Por eso el snapshot del formulario se toma recién al
  // entrar en modo edición, nunca al montar el componente.
  function iniciarEdicion() {
    setForm(formDesdeCaso(caso));
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const [resCaso, resVehiculo, resAsegurado] = await Promise.all([
      fetch(`/api/casos/${caso.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          rama: form.rama || null,
          tipo_tramite: form.tipo_tramite || null,
          registro_id: form.registro_id || null,
          tipo_baja_id: form.tipo_baja_id || null,
          responsable_id: form.responsable_id || null,
          gestor_id: form.gestor_id || null,
          fecha_cierre: form.fecha_cierre || null
        })
      }),
      fetch(`/api/vehiculos/${caso.vehiculo_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          casoId: caso.id,
          dominio: form.vehiculo_dominio.toUpperCase(),
          marca: form.vehiculo_marca || null,
          modelo: form.vehiculo_modelo || null,
          anio: form.vehiculo_anio ? Number(form.vehiculo_anio) : null
        })
      }),
      fetch(`/api/asegurados/${caso.asegurado_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          casoId: caso.id,
          nombre: form.asegurado_nombre,
          dni: form.asegurado_dni || null,
          telefono: form.asegurado_telefono || null,
          email: form.asegurado_email || null,
          direccion: form.asegurado_direccion || null,
          localidad: form.asegurado_localidad || null,
          provincia: form.asegurado_provincia || null,
          entre_calles: form.asegurado_entre_calles || null,
          partido: form.asegurado_partido || null
        })
      })
    ]);

    const [jsonCaso, jsonVehiculo, jsonAsegurado] = await Promise.all([
      resCaso.json(),
      resVehiculo.json(),
      resAsegurado.json()
    ]);
    setSaving(false);

    if (!resCaso.ok || !resVehiculo.ok || !resAsegurado.ok) {
      setError(
        jsonCaso.error ?? jsonVehiculo.error ?? jsonAsegurado.error ?? "No se pudo guardar el caso."
      );
      return;
    }

    const gestorNuevo = form.gestor_id && form.gestor_id !== (caso.gestor_id ?? "");
    if (gestorNuevo) {
      setNotificarGestor(jsonCaso.data as CasoConRelaciones);
    }

    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el caso ${caso.numero_siniestro}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/casos/${caso.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setError(json.error ?? "No se pudo eliminar el caso.");
      return;
    }

    router.push("/casos");
  }

  const enlaceGestor = origin ? `${origin}/g/${caso.token_gestor}` : "";

  async function copiarMensajeGestor() {
    const registroTexto = caso.registro
      ? `${caso.registro.seccional ? `${caso.registro.seccional} ` : ""}N° ${caso.registro.numero}`
      : "sin asignar todavía";
    const mensaje = [
      `Se te asignó un nuevo caso: siniestro ${caso.numero_siniestro}.`,
      `Tipo de Baja: ${caso.tipo_baja?.nombre ?? "—"}`,
      `Dominio: ${caso.vehiculo?.dominio ?? "—"}`,
      `Asegurado: ${caso.asegurado?.nombre ?? "—"} - Contacto: ${caso.asegurado?.telefono ?? "—"}`,
      `Registro de radicación: ${registroTexto}`,
      `Entrá a este enlace para ver los datos y cargar la documentación: ${enlaceGestor}`
    ].join("\n");

    await navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function regenerarEnlaceGestor() {
    if (!confirm("¿Regenerar el enlace? El enlace anterior va a dejar de funcionar para el gestor.")) {
      return;
    }

    setRegenerando(true);
    const res = await fetch(`/api/casos/${caso.id}/regenerar-enlace-gestor`, {
      method: "POST"
    });
    setRegenerando(false);

    if (res.ok) {
      router.refresh();
    }
  }

  const registrosPorProvincia = (() => {
    const grupos = new Map<string, RegistroAutomotor[]>();
    for (const r of registros) {
      const clave = r.provincia || "Sin provincia";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(r);
    }
    return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  return {
    editing,
    setEditing,
    iniciarEdicion,
    saving,
    deleting,
    error,
    setError,
    copiado,
    regenerando,
    notificarGestor,
    setNotificarGestor,
    form,
    update,
    handleSave,
    handleDelete,
    enlaceGestor,
    copiarMensajeGestor,
    regenerarEnlaceGestor,
    registrosPorProvincia,
    soloLectura
  };
}
