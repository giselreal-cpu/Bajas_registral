-- Localidad donde se encuentra la unidad a trasladar. Se carga en el evento
-- "Traslado" cuando se asigna un gruero, y es lo que ve el transportista en
-- su enlace y en el mensaje (junto con el dominio) en lugar del número de
-- siniestro, que para el traslado no le sirve.

alter table bitacora
  add column if not exists traslado_localidad text;
