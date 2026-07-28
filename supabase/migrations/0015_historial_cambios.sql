-- Historial de cambios por caso: quién hizo qué y cuándo. Se llena desde
-- el propio backend (no hay forma de cargarlo a mano), y no se puede
-- editar ni borrar una vez creado (es un registro de auditoría).

create table if not exists historial_cambios (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  tipo_cambio text not null,
  detalle text,
  created_at timestamptz not null default now()
);

create index if not exists idx_historial_caso on historial_cambios(caso_id);

alter table historial_cambios enable row level security;

-- Solo operador/administrador pueden ver el historial (compañía no
-- necesita ver el detalle de auditoría interna). Se inserta desde el
-- backend con la misma sesión de quien hizo el cambio, por eso también
-- necesita permiso de insert para ese rol. No hay políticas de
-- update/delete a propósito: nadie puede alterar el historial ya creado.
create policy "historial_select" on historial_cambios for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

create policy "historial_insert" on historial_cambios for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
