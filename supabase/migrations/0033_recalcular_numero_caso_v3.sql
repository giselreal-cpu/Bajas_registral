-- Mismo recálculo puntual que 0017 y 0026: un caso de prueba (creado y
-- borrado durante la verificación de las notificaciones por mail)
-- consumió un número real de la secuencia de numero_caso antes de
-- borrarse, dejando un hueco. Se vuelve a sacar el hueco y a resetear
-- la secuencia. Los casos demo (numero_caso = 0) quedan afuera.

with numerados as (
  select id, row_number() over (order by numero_caso) as n
  from casos
  where numero_caso <> 0
)
update casos c
set numero_caso = numerados.n
from numerados
where c.id = numerados.id;

select setval(
  pg_get_serial_sequence('casos', 'numero_caso'),
  (select coalesce(max(numero_caso), 0) from casos)
);
