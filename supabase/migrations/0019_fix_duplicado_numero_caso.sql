-- Un ajuste manual anterior (fuera del mecanismo de la app) dejó la
-- secuencia de numero_caso desincronizada, lo que generó un número
-- duplicado. Recalculamos de nuevo en el mismo orden relativo que ya
-- tenían (los casos demo, en 0, quedan afuera), y dejamos la secuencia
-- sincronizada con el nuevo máximo para que esto no se repita.

with numerados as (
  select id, row_number() over (order by numero_caso, created_at) as n
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
