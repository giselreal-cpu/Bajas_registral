-- Se amplía el catálogo de estados de "casos" para que cada evento clave
-- de la bitácora tenga un estado propio y así el seguimiento sea más
-- preciso (antes varios eventos distintos caían en el mismo estado, o no
-- movían ningún estado). No se renombra ni se toca ningún valor existente,
-- solo se agregan 3 nuevos.

alter table casos drop constraint if exists casos_estado_check;
alter table casos add constraint casos_estado_check check (estado in (
  'iniciado',
  'informes_solicitados',
  'en_verificacion',
  'autorizacion_traslado',
  'desarmadero_asignado',
  'traslado_realizado',
  'baja_en_tramite',
  'presentado_en_registro',
  'documentacion_enviada',
  'cerrado'
));
