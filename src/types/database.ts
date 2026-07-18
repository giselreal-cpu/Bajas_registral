export type Estado =
  | "iniciado"
  | "informes_solicitados"
  | "en_verificacion"
  | "autorizacion_traslado"
  | "desarmadero_asignado"
  | "baja_en_tramite"
  | "cerrado";

export const ESTADOS: { value: Estado; label: string }[] = [
  { value: "iniciado", label: "Iniciado" },
  { value: "informes_solicitados", label: "Informes solicitados" },
  { value: "en_verificacion", label: "En verificación" },
  { value: "autorizacion_traslado", label: "Autorización de traslado" },
  { value: "desarmadero_asignado", label: "Desarmadero asignado" },
  { value: "baja_en_tramite", label: "Baja en trámite" },
  { value: "cerrado", label: "Cerrado" }
];

export type Rama =
  | "normal"
  | "denuncia_robo"
  | "sucesion"
  | "inhibido_embargado"
  | "prendado"
  | "denuncia_venta"
  | "baja_04c";

export const RAMAS: { value: Rama; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "denuncia_robo", label: "Denuncia de robo" },
  { value: "sucesion", label: "Sucesión" },
  { value: "inhibido_embargado", label: "Inhibido / embargado" },
  { value: "prendado", label: "Prendado" },
  { value: "denuncia_venta", label: "Denuncia de venta" },
  { value: "baja_04c", label: "Baja 04C" }
];

export type TipoTramite = "fisica" | "digital";

export interface Aseguradora {
  id: string;
  nombre: string;
  cuit: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
}

export interface Asegurado {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}

export interface Vehiculo {
  id: string;
  dominio: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  chasis: string | null;
  motor: string | null;
}

export interface Desarmadero {
  id: string;
  nombre: string;
  cuit: string | null;
  contacto: string | null;
  direccion: string | null;
}

export interface RegistroAutomotor {
  id: string;
  numero: string;
  seccional: string | null;
  direccion: string | null;
}

export interface TipoBaja {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string | null;
}

export interface Caso {
  id: string;
  numero_siniestro: string;
  aseguradora_id: string;
  asegurado_id: string;
  vehiculo_id: string;
  desarmadero_id: string | null;
  registro_id: string | null;
  tipo_baja_id: string | null;
  responsable_id: string | null;
  estado: Estado;
  rama: Rama | null;
  tipo_tramite: TipoTramite | null;
  fecha_ingreso: string;
  fecha_cierre: string | null;
  deuda_patentes: number | null;
  deuda_multas: number | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

// Caso con los catálogos relacionados ya resueltos (para la vista de detalle/listado)
export interface CasoConRelaciones extends Caso {
  aseguradora: Aseguradora | null;
  asegurado: Asegurado | null;
  vehiculo: Vehiculo | null;
  desarmadero: Desarmadero | null;
  registro: RegistroAutomotor | null;
  tipo_baja: TipoBaja | null;
  responsable: Usuario | null;
}

export interface BitacoraEvento {
  id: string;
  caso_id: string;
  tipo_evento: string;
  observacion: string | null;
  es_interna: boolean;
  completado: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
  creado_por: string | null;
  created_at: string;
}

export interface Documento {
  id: string;
  caso_id: string;
  categoria: "imagen_dominio" | "documento_compania";
  nombre: string;
  url: string;
  created_at: string;
}
