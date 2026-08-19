-- Nuevo estado "Baja de Patentes Pendiente": se activa al cargar el evento
-- de bitácora "Baja de Patentes" (aún sin completar). Al completarse ese
-- evento, el caso pasa directo a "cerrado" (es el paso final). Va
-- ubicado justo antes de "cerrado" en la secuencia de avance.

alter table casos drop constraint if exists casos_estado_check;
alter table casos add constraint casos_estado_check check (estado in (
  'iniciado',
  'informes_solicitados',
  'en_verificacion',
  'autorizacion_traslado',
  'desarmadero_asignado',
  'traslado_realizado',
  'baja_en_tramite',
  'gestor_asignado',
  'presentado_en_registro',
  'documentacion_enviada',
  'baja_patentes_pendiente',
  'cerrado'
));
