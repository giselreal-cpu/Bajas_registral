-- Catálogo de trámitadores (la persona de la compañía que lleva el caso
-- de su lado) — hasta ahora era texto libre por caso
-- (casos.tramitador_nombre / tramitador_email, ver
-- 0013_productor_tramitador.sql), sin forma de filtrar con un
-- desplegable prolijo ni de evitar variantes de escritura del mismo
-- nombre. Se crea la tabla, se migran los nombres ya cargados, y se
-- agrega casos.tramitador_id.
--
-- Las columnas de texto NO se eliminan: notificaciones
-- (notificacionesCaso.ts), los exports y seguimiento financiero las
-- siguen leyendo tal cual. Quedan sincronizadas automáticamente desde
-- el servidor al crear o editar un caso (ver src/lib/tramitadores.ts),
-- sin cambiar el formulario de carga.

create table if not exists tramitadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  email text,
  created_at timestamptz not null default now()
);

alter table casos add column if not exists tramitador_id uuid references tramitadores(id);

-- Backfill: un registro por cada nombre distinto ya cargado (sin
-- distinguir mayúsculas/espacios), con el primer email no nulo que se
-- encuentre para ese nombre.
insert into tramitadores (nombre, email)
select distinct on (lower(trim(tramitador_nombre)))
  trim(tramitador_nombre) as nombre,
  tramitador_email as email
from casos
where tramitador_nombre is not null and trim(tramitador_nombre) <> ''
order by lower(trim(tramitador_nombre)), tramitador_email nulls last, created_at
on conflict (nombre) do nothing;

update casos c
set tramitador_id = t.id
from tramitadores t
where c.tramitador_nombre is not null
  and lower(trim(c.tramitador_nombre)) = lower(t.nombre)
  and c.tramitador_id is null;

-- RLS: mismo criterio que gestores (0021_modulo_gestor.sql) — lectura
-- para cualquier autenticado (incluida compañía, para poder filtrar),
-- escritura solo operador/administrador.
alter table tramitadores enable row level security;

drop policy if exists "tramitadores_select" on tramitadores;
create policy "tramitadores_select" on tramitadores for select
  using (auth.role() = 'authenticated');
create policy "tramitadores_insert" on tramitadores for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "tramitadores_update" on tramitadores for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "tramitadores_delete" on tramitadores for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
