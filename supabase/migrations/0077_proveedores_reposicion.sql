-- Proveedores de reposición: en algunos casos (hoy, los de Allianz) interviene
-- un proveedor de la compañía que gestiona la reposición de la unidad y
-- necesita seguir cómo va la baja. Se carga como catálogo (nombre + mails de
-- contacto, separados por coma) y se asigna, opcionalmente, a cada caso.
-- Es un destinatario más de los avisos por mail de la bitácora.

create table if not exists proveedores_reposicion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  emails text,
  telefono text,
  created_at timestamptz not null default now()
);

alter table proveedores_reposicion enable row level security;

create policy "proveedores_reposicion_select" on proveedores_reposicion for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "proveedores_reposicion_insert" on proveedores_reposicion for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "proveedores_reposicion_update" on proveedores_reposicion for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "proveedores_reposicion_delete" on proveedores_reposicion for delete
  using (rol_del_usuario_actual() = 'administrador');

-- Permisos de la API (desde el 30/10/2026 Supabase no los da solo en tablas nuevas).
grant select, insert, update, delete on public.proveedores_reposicion to authenticated;
grant select, insert, update, delete on public.proveedores_reposicion to service_role;

alter table casos
  add column if not exists proveedor_reposicion_id uuid references proveedores_reposicion(id) on delete set null;
