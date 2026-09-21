-- Mismo recálculo puntual que 0017/0026/0033/0034: se borró el caso 119
-- (estaba duplicado) y el siguiente caso creado quedó con el 120 en vez
-- de 119. Se vuelve a sacar el hueco (los casos quedan correlativos en
-- el orden actual) y se resetea la secuencia. Los casos demo
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
