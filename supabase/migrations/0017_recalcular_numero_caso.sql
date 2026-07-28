-- Recálculo puntual (una sola vez) para sacar los huecos que quedaron por
-- casos demo borrados hasta ahora. De acá en adelante, si se borra un
-- caso real, el hueco que deje NO se vuelve a recalcular automáticamente
-- (se mantiene el comportamiento normal: los números no se reutilizan).
-- Los casos demo (numero_caso = 0) quedan afuera de este recálculo.

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
