-- Enlace público para el gruero asignado en el evento de bitácora
-- "Traslado": le permite ver el dominio/vehículo y descargar la
-- Autorización de Retiro y Traslado (.docx) y las fotos del dominio, sin
-- necesitar cuenta. Es de solo lectura (a diferencia del enlace del
-- gestor, que además permite cargar archivos).

alter table bitacora add column if not exists token_gruero uuid not null default gen_random_uuid() unique;
