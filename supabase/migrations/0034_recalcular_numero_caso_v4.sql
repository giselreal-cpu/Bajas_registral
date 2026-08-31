-- Mismo recálculo puntual que 0017/0026/0033: un caso de prueba (creado
-- y borrado al verificar el mail de "inicio de trámite") consumió un
-- número real de la secuencia de numero_caso antes de borrarse. Se
-- vuelve a sacar el hueco y a resetear la secuencia. Los casos demo
-- (numero_caso = 0) quedan afuera.

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
