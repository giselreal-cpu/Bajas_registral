-- Nuevo estado "Cierre de Caso Pendiente": cuando el evento de bitácora
-- "Baja de Patentes" ya está completado, lo único que falta es cerrar el
-- caso — el estado deja de decir "Baja de Patentes Pendiente" y pasa a
-- "Cierre de Caso Pendiente". Va entre "Baja de Patentes Pendiente" y
-- "Cerrado" en la secuencia de avance.

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
  'cierre_pendiente',
  'cerrado'
));

-- Casos que hoy figuran en "Baja de Patentes Pendiente" pero cuyo evento
-- "Baja de Patentes" ya está completado.
update casos c
set estado = 'cierre_pendiente'
where c.estado = 'baja_patentes_pendiente'
  and exists (
    select 1
    from bitacora b
    where b.caso_id = c.id
      and b.tipo_evento = 'Baja de Patentes'
      and b.completado = true
  );
