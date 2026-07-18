// Catálogo de tipos de evento para la bitácora, basado en el flujo de
// negocio descripto en el CLAUDE.md. Los eventos con `orden` definido forman
// la secuencia principal del caso (no se puede completar uno si los
// anteriores en orden todavía no están completados). Los eventos con
// `orden: null` son de una rama específica (robo, sucesión, etc.) y no
// bloquean ni son bloqueados por la secuencia principal.

export interface TipoEventoDef {
  value: string;
  label: string;
  orden: number | null;
}

export const TIPOS_EVENTO: TipoEventoDef[] = [
  { value: "ingreso_caso", label: "Ingreso de caso", orden: 1 },
  { value: "informes_solicitados", label: "Informes de dominio solicitados", orden: 2 },
  { value: "informes_recibidos", label: "Informes de dominio recibidos", orden: 3 },
  { value: "contacto_asegurado", label: "Contacto con el asegurado", orden: 4 },
  { value: "verificacion_deudas", label: "Verificación de deudas de patente/multas", orden: 5 },

  // Ramas espec\u00edficas seg\u00fan el informe (no forman parte de la secuencia principal)
  { value: "denuncia_robo", label: "Denuncia de robo iniciada", orden: null },
  { value: "tramite_sucesion", label: "Trámite de sucesión iniciado", orden: null },
  { value: "verificacion_inhibicion", label: "Verificación de inhibido/embargado", orden: null },
  { value: "verificacion_prenda", label: "Verificación de prendado", orden: null },
  { value: "denuncia_venta", label: "Denuncia de venta presentada", orden: null },
  { value: "baja_04c", label: "Gestión de baja 04C", orden: null },

  { value: "autorizacion_traslado", label: "Autorización de traslado", orden: 6 },
  { value: "verificacion_tenencia", label: "Verificación de tenencia definitiva", orden: 7 },
  { value: "asignacion_desarmadero", label: "Asignación de desarmadero", orden: 8 },
  { value: "inicio_baja", label: "Inicio de trámite de baja", orden: 9 },
  { value: "presentacion_registro", label: "Presentación en el registro", orden: 10 },
  { value: "envio_documentacion", label: "Envío de documentación (compañía y desarmadero)", orden: 11 },
  { value: "cierre_caso", label: "Cierre del caso", orden: 12 },

  { value: "otro", label: "Otro", orden: null }
];

// Dado el orden del evento que se quiere agregar/completar, devuelve la
// lista de pasos previos de la secuencia principal que todavía no están
// completados (según los eventos ya cargados en la bitácora del caso).
export function pasosPendientesAnteriores(
  ordenNuevo: number,
  eventosExistentes: { tipo_evento: string; completado: boolean }[]
): string[] {
  const pasosPrevios = TIPOS_EVENTO.filter(
    (t) => t.orden !== null && t.orden < ordenNuevo
  );

  const pendientes: string[] = [];
  for (const paso of pasosPrevios) {
    const yaCompletado = eventosExistentes.some(
      (ev) => ev.tipo_evento === paso.label && ev.completado
    );
    if (!yaCompletado) pendientes.push(paso.label);
  }
  return pendientes;
}

export function ordenDeEvento(label: string): number | null {
  return TIPOS_EVENTO.find((t) => t.label === label)?.orden ?? null;
}
