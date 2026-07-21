// Catálogo cerrado de tipos de evento de bitácora. A diferencia de la
// versión anterior (que era una secuencia numerada de 18 pasos), acá cada
// tipo de evento indica puntualmente cuál es el evento anterior que debe
// estar completado antes de poder completar este (campo `requiere`).
// Un evento con `requiere: null` no tiene ninguna dependencia.

export interface TipoEventoDef {
  value: string;
  label: string;
  requiere: string | null; // label del tipo de evento que debe estar completado antes
}

export const TIPOS_EVENTO: TipoEventoDef[] = [
  { value: "ingreso_caso", label: "Ingreso de caso", requiere: null },
  { value: "peticion_informes", label: "Petición de Informes", requiere: null },
  { value: "contacto_asegurado", label: "Contacto con el asegurado", requiere: null },
  {
    value: "autorizacion_traslado",
    label: "Autorización de traslado",
    requiere: "Contacto con el asegurado"
  },
  {
    value: "asignacion_desarmadero",
    label: "Asignación de desarmadero",
    requiere: "Autorización de traslado"
  },
  { value: "traslado", label: "Traslado", requiere: null },
  {
    value: "formulario_baja",
    label: "Formulario de Baja",
    requiere: "Asignación de desarmadero"
  },
  {
    value: "presentacion_baja",
    label: "Presentación de Baja",
    requiere: "Asignación de desarmadero"
  },
  {
    value: "envio_documentacion_cia",
    label: "Envío de documentación Cía",
    requiere: "Asignación de desarmadero"
  },
  {
    value: "cierre_caso",
    label: "Cierre de Caso",
    requiere: "Asignación de desarmadero"
  },
  { value: "observaciones", label: "Observaciones", requiere: null }
];

export function tipoEventoDe(label: string): TipoEventoDef | undefined {
  return TIPOS_EVENTO.find((t) => t.label === label);
}

// Devuelve el mensaje de bloqueo si el evento `label` no puede marcarse
// como completado todavía (porque su prerequisito no está completado), o
// null si se puede completar sin problema. `idEventoActual` se excluye de
// la búsqueda (útil al editar un evento existente).
export function motivoBloqueo(
  label: string,
  eventosExistentes: { id: string; tipo_evento: string; completado: boolean }[],
  idEventoActual?: string
): string | null {
  const tipo = tipoEventoDe(label);
  if (!tipo || !tipo.requiere) return null;

  const requisitoCumplido = eventosExistentes.some(
    (ev) =>
      ev.tipo_evento === tipo.requiere &&
      ev.completado &&
      ev.id !== idEventoActual
  );

  if (!requisitoCumplido) {
    return `No se puede completar "${label}" porque "${tipo.requiere}" todavía no está completado.`;
  }
  return null;
}
