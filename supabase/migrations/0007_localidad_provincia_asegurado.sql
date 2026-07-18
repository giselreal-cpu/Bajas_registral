-- La autorización de retiro necesita localidad y provincia además de la
-- dirección del asegurado, que ya existía pero no se estaba cargando
-- desde el formulario de alta de caso.

alter table asegurados add column if not exists localidad text;
alter table asegurados add column if not exists provincia text;
