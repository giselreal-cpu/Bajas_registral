-- El desarmadero se asigna ahora desde el propio evento de bitácora
-- "Asignación de desarmadero" (igual patrón que gruero_nombre /
-- formulario_baja_nombre), y se replica en casos.desarmadero_id desde
-- el servidor. El campo de la cabecera del caso pasa a ser de solo
-- lectura.

alter table bitacora add column if not exists desarmadero_id uuid references desarmaderos(id);
