-- Datos del gruero (nombre + contacto) a quien se le asigna el traslado de
-- la unidad, cargados dentro del evento de bitácora "Traslado".

alter table bitacora add column if not exists gruero_nombre text;
alter table bitacora add column if not exists gruero_contacto text;
