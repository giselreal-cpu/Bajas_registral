-- Módulo de Gestor de campo: catálogo de gestores, asignación a casos con
-- enlace público (token) para que carguen archivos sin necesitar cuenta en
-- el sistema, y bucket de Storage para la subida real de archivos.

create table if not exists gestores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  created_at timestamptz not null default now()
);

alter table casos add column if not exists gestor_id uuid references gestores(id);
alter table casos add column if not exists token_gestor uuid not null default gen_random_uuid() unique;

-- Nuevas categorías de documentos para lo que carga el gestor desde el
-- enlace público. Se suman a las 2 existentes, no las reemplazan.
alter table documentos drop constraint if exists documentos_categoria_check;
alter table documentos add constraint documentos_categoria_check check (
  categoria in (
    'imagen_dominio',
    'documento_compania',
    'turno_registro',
    'observaciones_gestor',
    'recibos_gestor',
    'otros_gestor'
  )
);

-- Bucket privado para los archivos de documentos (fotos, recibos, etc.).
-- Todo el acceso (lectura vía URL firmada, escritura) se hace server-side
-- con la service role key, así que no hace falta ninguna policy pública
-- sobre storage.objects.
insert into storage.buckets (id, name, public)
values ('documentos-casos', 'documentos-casos', false)
on conflict (id) do nothing;

alter table gestores enable row level security;

-- Mismo patrón de RLS que los demás catálogos de trabajo (aseguradoras,
-- desarmaderos, registros_automotores, tipos_baja): lectura para cualquier
-- autenticado, escritura solo para operador/administrador.
drop policy if exists "gestores_select" on gestores;
create policy "gestores_select" on gestores for select
  using (auth.role() = 'authenticated');
create policy "gestores_insert" on gestores for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "gestores_update" on gestores for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "gestores_delete" on gestores for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
