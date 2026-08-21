-- Datos de la persona asignada a completar el Formulario de Baja (04D) y
-- enlace público para que cargue el documento completado, análogo al
-- patrón ya usado para el gruero (Traslado) pero con carga real de
-- archivo (como el gestor de campo).

alter table bitacora add column if not exists formulario_baja_nombre text;
alter table bitacora add column if not exists formulario_baja_contacto text;
alter table bitacora add column if not exists token_formulario_baja uuid not null default gen_random_uuid() unique;

alter table documentos drop constraint if exists documentos_categoria_check;
alter table documentos add constraint documentos_categoria_check check (
  categoria in (
    'imagen_dominio',
    'documento_compania',
    'turno_registro',
    'observaciones_gestor',
    'recibos_gestor',
    'otros_gestor',
    'formulario_baja'
  )
);
