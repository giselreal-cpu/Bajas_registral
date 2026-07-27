-- Número correlativo propio del sistema (separado del número de
-- siniestro), autonumerado, para poder enumerar los casos en el orden en
-- que se van cargando.

alter table casos add column if not exists numero_caso serial;

-- Renumerar los casos ya existentes en orden cronológico de ingreso, para
-- que el primero cargado sea el Nº 1, el segundo el Nº 2, etc.
with numerados as (
  select id, row_number() over (order by fecha_ingreso, created_at) as n
  from casos
)
update casos c set numero_caso = numerados.n
from numerados
where c.id = numerados.id;

-- Dejar la secuencia lista para que los próximos casos nuevos sigan
-- numerando a partir del máximo actual.
select setval(
  pg_get_serial_sequence('casos', 'numero_caso'),
  (select coalesce(max(numero_caso), 0) from casos)
);
