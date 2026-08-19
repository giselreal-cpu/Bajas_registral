export type Estado =
  | "iniciado"
  | "informes_solicitados"
  | "en_verificacion"
  | "autorizacion_traslado"
  | "desarmadero_asignado"
  | "traslado_realizado"
  | "baja_en_tramite"
  | "gestor_asignado"
  | "presentado_en_registro"
  | "documentacion_enviada"
  | "baja_patentes_pendiente"
  | "cerrado";

export const ESTADOS: { value: Estado; label: string }[] = [
  { value: "iniciado", label: "Iniciado" },
  { value: "informes_solicitados", label: "Informes solicitados" },
  { value: "en_verificacion", label: "En verificación" },
  { value: "autorizacion_traslado", label: "Autorización de traslado" },
  { value: "desarmadero_asignado", label: "Desarmadero asignado" },
  { value: "traslado_realizado", label: "Traslado realizado" },
  { value: "baja_en_tramite", label: "Formulario de baja presentado" },
  { value: "gestor_asignado", label: "Gestor Asignado" },
  { value: "presentado_en_registro", label: "Presentado en el registro" },
  { value: "documentacion_enviada", label: "Documentación enviada a la Cía" },
  { value: "baja_patentes_pendiente", label: "Baja de Patentes Pendiente" },
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
  localidad: string | null;
  provincia: string | null;
  entre_calles: string | null;
  partido: string | null;
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
  provincia: string | null;
}

export interface RegistroAutomotor {
  id: string;
  numero: string;
  seccional: string | null;
  provincia: string | null;
}

export interface TipoBaja {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Gestor {
  id: string;
  nombre: string;
  contacto: string | null;
}

export type RolUsuario = "operador" | "administrador" | "compania";

export const ROLES: { value: RolUsuario; label: string }[] = [
  { value: "operador", label: "Operador" },
  { value: "administrador", label: "Administrador" },
  { value: "compania", label: "Compañía" }
];

export interface Usuario {
  id: string;
  nombre: string;
  email: string | null;
  auth_user_id: string | null;
  rol: RolUsuario;
  aseguradora_id: string | null;
}

export interface Caso {
  id: string;
  numero_caso: number;
  numero_siniestro: string;
  numero_poliza: string | null;
  item_poliza: string | null;
  aseguradora_id: string;
  asegurado_id: string;
  vehiculo_id: string;
  desarmadero_id: string | null;
  registro_id: string | null;
  tipo_baja_id: string | null;
  responsable_id: string | null;
  gestor_id: string | null;
  token_gestor: string;
  estado: Estado;
  rama: Rama | null;
  tipo_tramite: TipoTramite | null;
  fecha_ingreso: string;
  fecha_cierre: string | null;
  deuda_patentes: number | null;
  deuda_multas: number | null;
  observaciones: string | null;
  tercero_nombre: string | null;
  tercero_dni: string | null;
  tercero_contacto: string | null;
  suma_asegurada: number | null;
  productor_nombre: string | null;
  productor_contacto: string | null;
  tramitador_nombre: string | null;
  tramitador_email: string | null;
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
  gestor: Gestor | null;
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
  gruero_nombre: string | null;
  gruero_contacto: string | null;
  token_gruero: string;
  creado_por: string | null;
  created_at: string;
}

export type CategoriaDocumento =
  | "imagen_dominio"
  | "documento_compania"
  | "turno_registro"
  | "observaciones_gestor"
  | "recibos_gestor"
  | "otros_gestor";

export const CATEGORIAS_GESTOR: { value: CategoriaDocumento; label: string }[] = [
  { value: "turno_registro", label: "Turno en Registro" },
  { value: "observaciones_gestor", label: "Observaciones" },
  { value: "recibos_gestor", label: "Recibos" },
  { value: "otros_gestor", label: "Otros" }
];

export interface Documento {
  id: string;
  caso_id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  url: string;
  url_firmada?: string;
  created_at: string;
}

export interface HistorialCambio {
  id: string;
  caso_id: string;
  usuario_id: string | null;
  tipo_cambio: string;
  detalle: string | null;
  created_at: string;
  usuario: { nombre: string } | null;
}
