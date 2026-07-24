-- Simplificación pedida: el catálogo de registros automotores se queda
-- solo con número de registro, denominación (seccional) y provincia. Se
-- sacan dirección y teléfono (este último se había agregado de más en la
-- migración anterior).

alter table registros_automotores drop column if exists telefono;
alter table registros_automotores drop column if exists direccion;
