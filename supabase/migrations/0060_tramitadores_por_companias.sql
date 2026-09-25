-- Los trámitadores pertenecen a una compañía (son gente de esa
-- aseguradora), así que el catálogo pasa a estar organizado por
-- compañía: al cargar un caso el desplegable muestra solo los de la
-- aseguradora elegida, y se puede agregar uno nuevo ahí mismo. Evita
-- las variantes de escritura del mismo nombre ("Jorge Elias" vs
-- "Jorge Elias Garcia") y que un mismo nombre de dos compañías se
-- mezcle.

alter table tramitadores add column if not exists aseguradora_id uuid references aseguradoras(id);

-- Backfill: cada trámitador ya cargado toma la aseguradora de los
-- casos donde se usa (hoy ninguno se usa en más de una compañía).
update tramitadores t
set aseguradora_id = x.aseguradora_id
from (
  select distinct on (tramitador_id) tramitador_id, aseguradora_id
  from casos
  where tramitador_id is not null
  order by tramitador_id, created_at
) x
where t.id = x.tramitador_id and t.aseguradora_id is null;

-- Antes el nombre era único a nivel global; ahora es único dentro de
-- cada compañía (sin distinguir mayúsculas ni espacios).
alter table tramitadores drop constraint if exists tramitadores_nombre_key;
create unique index if not exists tramitadores_aseguradora_nombre_uniq
  on tramitadores (aseguradora_id, lower(trim(nombre)));
