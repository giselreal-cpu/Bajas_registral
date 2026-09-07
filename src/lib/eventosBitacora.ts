// Catálogo cerrado de tipos de evento de bitácora. A diferencia de la
// versión anterior (que era una secuencia numerada de 18 pasos), acá cada
// tipo de evento indica puntualmente cuál/cuáles son los eventos
// anteriores que deben estar completados antes de poder completar este
// (campo `requiere`). Un evento con `requiere: null` no tiene ninguna
// dependencia; puede pedir un solo prerequisito (string) o varios a la
// vez (string[], deben estar TODOS completados) — es el caso de "Cierre
// de Caso", que no se puede cerrar si queda algún evento clave pendiente.

export interface TipoEventoDef {
  value: string;
  label: string;
  requiere: string | string[] | null;
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
  { value: "traslado", label: "Traslado", requiere: "Petición de Informes" },
  {
    value: "formulario_baja",
    label: "Formulario de Baja",
    // En la práctica el 04D a veces se completa antes de que la unidad
    // termine de trasladarse (no siempre van en ese orden estricto), así
    // que este evento ya no exige "Traslado" completado — BitacoraSection
    // muestra un aviso (no bloqueante) si se completa sin Traslado. El
    // bloqueo real sigue estando en "Cierre de Caso", que sí exige
    // "Traslado" completado.
    requiere: null
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
    // No se puede cerrar el caso si queda alguno de estos eventos clave
    // sin completar (a pedido explícito del usuario).
    requiere: [
      "Petición de Informes",
      "Autorización de traslado",
      "Traslado",
      "Formulario de Baja",
      "Presentación de Baja",
      "Envío de documentación Cía"
    ]
  },
  { value: "baja_patentes", label: "Baja de Patentes", requiere: null },
  { value: "observaciones", label: "Observaciones", requiere: null }
];

export function tipoEventoDe(label: string): TipoEventoDef | undefined {
  return TIPOS_EVENTO.find((t) => t.label === label);
}

// Devuelve el mensaje de bloqueo si el evento `label` no puede marcarse
// como completado todavía (porque algún prerequisito no está completado),
// o null si se puede completar sin problema. `idEventoActual` se excluye
// de la búsqueda (útil al editar un evento existente).
export function motivoBloqueo(
  label: string,
  eventosExistentes: { id: string; tipo_evento: string; completado: boolean }[],
  idEventoActual?: string
): string | null {
  const tipo = tipoEventoDe(label);
  if (!tipo || !tipo.requiere) return null;

  const requisitos = Array.isArray(tipo.requiere) ? tipo.requiere : [tipo.requiere];
  const faltantes = requisitos.filter(
    (req) =>
      !eventosExistentes.some(
        (ev) => ev.tipo_evento === req && ev.completado && ev.id !== idEventoActual
      )
  );

  if (faltantes.length > 0) {
    return faltantes.length === 1
      ? `No se puede completar "${label}" porque "${faltantes[0]}" todavía no está completado.`
      : `No se puede completar "${label}" porque todavía no están completados: ${faltantes.join(", ")}.`;
  }
  return null;
}
