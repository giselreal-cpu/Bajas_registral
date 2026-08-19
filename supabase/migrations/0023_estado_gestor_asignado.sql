-- Nuevo estado "Gestor Asignado": se usa cuando se asigna un gestor de
-- campo a un caso, en vez de saltar directo a "Presentado en el registro"
-- (eso lo deja para cuando el gestor efectivamente lo presente). Va
-- ubicado entre "baja_en_tramite" y "presentado_en_registro" en la
-- secuencia de avance.

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
  'cerrado'
));
