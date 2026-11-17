// Seguimiento de un caso para el productor (asesor de seguros): cómo viene el
// trámite, en lenguaje claro, por mail. Sin finanzas internas ni estimaciones
// de tiempo (cada caso depende de terceros: registro, compañía, asegurado).
//
// Las funciones de este archivo son puras; la API que arma y envía el mail
// está en /api/casos/[id]/seguimiento-productor.

import { esBajaDigital, NOMBRE_IPV } from "@/lib/tipoBaja";
import { esSoloInformes } from "@/lib/eventosBitacora";
import { EMAIL_CONTACTO } from "@/lib/contacto";

export interface EventoSeguimiento {
  tipo_evento: string;
  completado: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  es_interna?: boolean;
  observacion?: string | null;
}

export interface DatosSeguimiento {
  numero_siniestro: string;
  dominio: string;
  aseguradora: string;
  asegurado: string;
  tipo_baja: string | null;
  rama: string | null;
  estado: string;
  anulado?: boolean;
  deuda_patentes: number | null;
  deuda_multas: number | null;
  tieneGestor: boolean;
  responsable: { nombre: string; email: string | null } | null;
  eventos: EventoSeguimiento[];
}

export interface Hito {
  titulo: string;
  completado: boolean;
  enEspera?: boolean; // ya realizado, a la espera de un tercero
  pendienteTexto?: string; // en lugar de "pendiente"
  faltaDocAsegurado?: boolean;
  fecha: string | null; // AAAA-MM-DD
}

export interface Seguimiento {
  frase: string;
  esperando: string | null;
  luego: string | null;
  hitos: Hito[];
}

// Frase de estado en lenguaje claro (no la etiqueta interna del sistema).
const FRASE_POR_ESTADO: Record<string, string> = {
  iniciado: "Recibimos el caso y estamos iniciando el trámite.",
  informes_solicitados: "Pedimos los informes del dominio al registro automotor.",
  en_verificacion: "Estamos en contacto con el asegurado y verificando la documentación y las deudas de la unidad.",
  autorizacion_traslado: "Tenemos la autorización de traslado y coordinamos el retiro de la unidad.",
  desarmadero_asignado: "Ya está asignado el desarmadero y coordinamos el retiro de la unidad.",
  traslado_realizado: "La unidad ya fue retirada y estamos preparando la presentación de la baja.",
  baja_en_tramite: "El formulario de baja está completo y se está gestionando su presentación en el registro.",
  gestor_asignado: "Hay un gestor asignado para presentar la baja en el registro automotor.",
  presentado_en_registro: "La presentación de la baja en el registro automotor está finalizada.",
  documentacion_enviada: "Enviamos la documentación de la baja a la compañía.",
  baja_patentes_pendiente: "La baja ya fue presentada; resta la baja de patentes.",
  cierre_pendiente: "Están completos todos los trámites; resta cerrar el caso.",
  cerrado: "El caso está cerrado: la baja quedó finalizada."
};

interface PasoDef {
  titulo: string;
  evento?: string; // evento de bitácora que lo completa
  esperando?: string; // cómo se nombra mientras se espera
  soloSiExiste?: boolean; // solo aparece si el evento está cargado
  derivado?: "gestor";
  // Cuando el evento está cargado pero sin completar, el paso ya se hizo y se
  // espera a un tercero (ej.: la baja ya se presentó y el registro la procesa).
  enEspera?: { titulo: string; esperando: string };
  // Cuando el evento todavía no se inició y la causa es de un tercero (ej.: en
  // 04 Digital, documentación que falta del asegurado).
  sinIniciar?: { esperando: string; detalle: string };
}

function pasosSegunTipo(tipoBaja: string | null): PasoDef[] {
  if (esSoloInformes(tipoBaja)) {
    return [
      { titulo: "Inicio del trámite", evento: "Ingreso de caso" },
      { titulo: "Informes del dominio solicitados", evento: "Petición de Informes", esperando: "Que el registro emita los informes del dominio" },
      { titulo: "Revisión de la documentación", evento: "Revisión de documentación", esperando: "La revisión de la documentación" },
      { titulo: "Informes enviados a la compañía", evento: "Envío de documentación Cía", esperando: "El envío de los informes a la compañía" },
      { titulo: "Cierre del caso", evento: "Cierre de Caso", esperando: "El cierre del caso" }
    ];
  }
  const formulario = esBajaDigital(tipoBaja) ? NOMBRE_IPV : "formulario de baja";
  return [
    { titulo: "Inicio del trámite", evento: "Ingreso de caso" },
    { titulo: "Contacto con el asegurado", evento: "Contacto con el asegurado", esperando: "El contacto con el asegurado" },
    { titulo: "Autorización de traslado", evento: "Autorización de traslado", esperando: "La autorización de traslado" },
    { titulo: "Retiro de la unidad", evento: "Traslado", esperando: "El retiro de la unidad" },
    { titulo: "Gestor asignado", derivado: "gestor" },
    { titulo: `Completado el ${formulario}`, evento: "Formulario de Baja", esperando: `Que se complete el ${formulario}` },
    {
      titulo: "Presentación de la baja en el registro",
      evento: "Presentación de Baja",
      esperando: "La presentación de la baja en el registro",
      enEspera: {
        titulo: "Baja presentada en el registro, a la espera de que la procese",
        esperando: "Que el registro procese la baja presentada"
      },
      // En la baja digital, la presentación no se inicia mientras falte
      // documentación por parte del asegurado.
      ...(esBajaDigital(tipoBaja)
        ? {
            sinIniciar: {
              esperando: "La documentación pendiente del asegurado para poder presentar la baja",
              detalle: "a la espera de documentación del asegurado"
            }
          }
        : {})
    },
    { titulo: "Documentación enviada a la compañía", evento: "Envío de documentación Cía", esperando: "El envío de la documentación a la compañía" },
    { titulo: "Baja de patentes", evento: "Baja de Patentes", esperando: "La baja de patentes", soloSiExiste: true },
    { titulo: "Cierre del caso", evento: "Cierre de Caso", esperando: "El cierre del caso" }
  ];
}

export function construirSeguimiento(d: DatosSeguimiento): Seguimiento {
  const hitos: Hito[] = [];
  const pendientes: { titulo: string; esperando: string }[] = [];

  for (const paso of pasosSegunTipo(d.tipo_baja)) {
    if (paso.derivado === "gestor") {
      // Solo se muestra si el caso lleva gestor de campo.
      if (d.tieneGestor) hitos.push({ titulo: paso.titulo, completado: true, fecha: null });
      continue;
    }
    const ev = d.eventos.find((e) => e.tipo_evento === paso.evento);
    if (!ev && paso.soloSiExiste) continue;
    const completado = !!ev?.completado;
    if (ev && !completado && paso.enEspera) {
      // Ya hecho, a la espera de un tercero: no es "pendiente" para el productor.
      hitos.push({ titulo: paso.enEspera.titulo, completado: false, enEspera: true, fecha: ev.fecha_inicio ?? null });
      pendientes.push({ titulo: paso.enEspera.titulo, esperando: paso.enEspera.esperando });
      continue;
    }
    if (!ev && paso.sinIniciar) {
      hitos.push({ titulo: paso.titulo, completado: false, pendienteTexto: paso.sinIniciar.detalle, faltaDocAsegurado: true, fecha: null });
      pendientes.push({ titulo: paso.titulo, esperando: paso.sinIniciar.esperando });
      continue;
    }
    hitos.push({ titulo: paso.titulo, completado, fecha: completado ? ev?.fecha_fin ?? ev?.fecha_inicio ?? null : null });
    if (!completado && paso.esperando) pendientes.push({ titulo: paso.titulo, esperando: paso.esperando });
  }

  const hayEspera = hitos.some((h) => h.enEspera);
  // Baja digital con el IPV completo pero sin presentar: falta documentación del asegurado.
  const ipvCompleto = d.eventos.some((e) => e.tipo_evento === "Formulario de Baja" && e.completado);
  const faltaDoc = ipvCompleto && hitos.some((h) => h.faltaDocAsegurado);

  // Un paso ya presentado y a la espera de un tercero es lo más avanzado del
  // caso: se informa ese, aunque queden pasos anteriores sin tildar en la
  // bitácora (no siempre se cargan en orden). "Luego" es lo que viene después.
  const idxEspera = pendientes.findIndex((p) =>
    hitos.some((h) => h.titulo === p.titulo && (h.enEspera || (h.faltaDocAsegurado && ipvCompleto)))
  );
  const actual = idxEspera >= 0 ? idxEspera : 0;
  let esperando = pendientes[actual]?.esperando ?? null;
  const siguiente = pendientes[actual + 1]?.esperando ?? null;
  // En un 04C el cierre suele quedar esperando el certificado de compactación.
  if (esperando === "El cierre del caso" && d.tipo_baja === "04C") {
    esperando = "El cierre del caso, a la espera del certificado de compactación";
  }

  // Si la baja ya se presentó y se espera al registro, el estado lo dice así
  // (aunque el estado interno todavía sea uno anterior).
  const ESTADOS_POSTERIORES = ["presentado_en_registro", "documentacion_enviada", "baja_patentes_pendiente", "cierre_pendiente", "cerrado"];
  const fraseEspera =
    hayEspera && !ESTADOS_POSTERIORES.includes(d.estado)
      ? "La baja ya fue presentada en el registro automotor y estamos a la espera de que la procese."
      : null;

  const fraseDoc =
    faltaDoc && !ESTADOS_POSTERIORES.includes(d.estado)
      ? `El ${NOMBRE_IPV} está completo; para presentar la baja falta documentación por parte del asegurado.`
      : null;

  return {
    frase: d.anulado ? "El caso fue anulado." : fraseEspera ?? fraseDoc ?? FRASE_POR_ESTADO[d.estado] ?? "El trámite está en curso.",
    esperando: d.estado === "cerrado" || d.anulado ? null : esperando,
    luego: d.estado === "cerrado" || d.anulado ? null : siguiente,
    hitos
  };
}

const RAMA_TEXTO: Record<string, string> = {
  denuncia_robo: "Denuncia de robo",
  sucesion: "Sucesión",
  inhibido_embargado: "Inhibido / embargado",
  prendado: "Prendado",
  denuncia_venta: "Denuncia de venta",
  baja_04c: "Baja 04C"
};

function pesos(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function fechaCorta(fecha: string): string {
  const [a, m, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

// Última observación pública de la bitácora (las internas nunca se incluyen).
export function ultimaObservacionPublica(eventos: EventoSeguimiento[]): { fecha: string; texto: string } | null {
  const obs = eventos
    .filter((e) => e.tipo_evento === "Observaciones" && !e.es_interna && (e.observacion ?? "").trim())
    .sort((a, b) => (b.fecha_inicio ?? "").localeCompare(a.fecha_inicio ?? ""));
  return obs[0] ? { fecha: obs[0].fecha_inicio ?? "", texto: (obs[0].observacion ?? "").trim() } : null;
}

export function mailSeguimiento(
  d: DatosSeguimiento,
  opciones: { incluirObservacion?: boolean } = {}
): { subject: string; text: string } {
  const seg = construirSeguimiento(d);
  const lineas: string[] = [];

  lineas.push("Hola,", "");
  lineas.push(
    `Te compartimos cómo viene el trámite de baja del vehículo dominio ${d.dominio} (Siniestro N° ${d.numero_siniestro}, ${d.aseguradora}, asegurado ${d.asegurado}).`,
    ""
  );
  lineas.push(`ESTADO ACTUAL: ${seg.frase}`);
  if (seg.esperando) lineas.push(`Estamos gestionando: ${seg.esperando}.`);
  if (seg.luego) lineas.push(`Luego: ${seg.luego.charAt(0).toLowerCase()}${seg.luego.slice(1)}.`);

  const conDeuda = (d.deuda_patentes ?? 0) > 0 || (d.deuda_multas ?? 0) > 0;
  const rama = d.rama && RAMA_TEXTO[d.rama] && d.rama !== "baja_04c" ? RAMA_TEXTO[d.rama] : null;
  if (conDeuda || rama) {
    lineas.push("", "SITUACIÓN DE LA UNIDAD");
    if (conDeuda) lineas.push(`Deuda de patentes: ${pesos(d.deuda_patentes)} · Multas: ${pesos(d.deuda_multas)}`);
    if (rama) lineas.push(`Particularidad del caso: ${rama}`);
  }

  lineas.push("", "AVANCE");
  for (const h of seg.hitos) {
    if (h.completado) lineas.push(`✔ ${h.titulo}${h.fecha ? ` — ${fechaCorta(h.fecha)}` : ""}`);
    else if (h.enEspera) lineas.push(`⏳ ${h.titulo}${h.fecha ? ` — desde el ${fechaCorta(h.fecha)}` : ""}`);
    else lineas.push(`• ${h.titulo} — ${h.pendienteTexto ?? "pendiente"}`);
  }

  if (opciones.incluirObservacion) {
    const o = ultimaObservacionPublica(d.eventos);
    if (o) lineas.push("", `ÚLTIMA NOVEDAD${o.fecha ? ` (${fechaCorta(o.fecha)})` : ""}`, o.texto);
  }

  // El mail de contacto es siempre el de Oltra, aunque el responsable tenga
  // otro cargado (a futuro, un mail propio con el dominio ogi.com.ar).
  lineas.push(
    "",
    d.responsable
      ? `Cualquier consulta, contactate con ${d.responsable.nombre} de Oltra Gestión Integral (${EMAIL_CONTACTO}).`
      : `Cualquier consulta, escribinos a ${EMAIL_CONTACTO}.`
  );
  lineas.push("", "Saludos,", "Oltra Gestión Integral");

  return {
    subject: `Seguimiento · Siniestro ${d.numero_siniestro} · Dominio ${d.dominio} · ${d.aseguradora}`,
    text: lineas.join("\n")
  };
}
