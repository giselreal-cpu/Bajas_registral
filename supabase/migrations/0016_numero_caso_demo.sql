-- Los casos de demo/prueba (los que quedaron de la aseguradora sembrada
-- en 0002_seed_demo.sql) no deben ocupar un lugar en la numeración
-- correlativa real de casos: se marcan con numero_caso = 0.

update casos c
set numero_caso = 0
from aseguradoras a
where c.aseguradora_id = a.id
  and a.nombre = 'Aseguradora Demo S.A.';
