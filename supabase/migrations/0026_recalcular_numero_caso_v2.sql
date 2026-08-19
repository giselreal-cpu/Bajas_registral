-- Recálculo puntual (una sola vez) para sacar los huecos que quedaron en
-- numero_caso por casos de prueba creados sin usar la aseguradora demo
-- (consumieron números reales de la secuencia antes de borrarse). Mismo
-- enfoque que 0017_recalcular_numero_caso.sql. Los casos demo
-- (numero_caso = 0) quedan afuera de este recálculo.

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
