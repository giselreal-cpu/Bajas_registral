// Mensajes (para pegar en WhatsApp) que se le mandan al desarmadero con el
// enlace de seguimiento del caso.

interface DatosMensaje {
  numeroSiniestro: string;
  dominio: string | null | undefined;
  marca?: string | null;
  modelo?: string | null;
  enlace: string;
}

// "VOLKSWAGEN GOL TREND 1.6"; si el vehículo no tiene marca ni modelo, el
// número de siniestro.
function descripcionVehiculo(d: DatosMensaje): string {
  const texto = [d.marca, d.modelo]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return texto || d.numeroSiniestro;
}

// Primer aviso: llega un vehículo.
export function mensajeLlegaVehiculo(d: DatosMensaje): string {
  return [
    `Te llega un vehículo por el caso ${d.numeroSiniestro}.`,
    `Dominio: ${d.dominio ?? "—"}`,
    `Podés seguir el estado del trámite acá: ${d.enlace}`
  ].join("\n");
}

// Segundo aviso: la documentación ya está lista para cargar en RUDAC.
export function mensajeDocumentacionLista(d: DatosMensaje): string {
  return [
    `Ya tenés la documentación por el caso ${descripcionVehiculo(d)}. Podés cargarla en el sistema del RUDAC, o bien revisar la documentación y completar la carga desde el enlace.`,
    `Dominio: ${d.dominio ?? "—"}`,
    d.enlace
  ].join("\n");
}
