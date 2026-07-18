-- Antes, cualquier cuenta autenticada (aunque nadie la hubiera vinculado
-- ni aprobado todavía) podía leer los catálogos de trabajo. Y no había
-- ninguna fila visible para que un administrador supiera que alguien
-- nuevo se había logueado. Esta migración arregla las dos cosas:
--
-- 1. El rol ya no tiene un valor por defecto: una cuenta nueva queda con
--    rol = NULL ("pendiente de aprobación") hasta que un administrador le
--    asigne explícitamente Operador / Administrador / Compañía.
-- 2. Un trigger crea automáticamente una fila en `usuarios` (sin rol)
--    cada vez que alguien se loguea por primera vez, sea por Google o por
--    email/contraseña, para que el administrador la vea en
--    Catálogos → Usuarios y decida qué hacer.
-- 3. Los catálogos de trabajo y la propia tabla `usuarios` ahora exigen
--    tener un rol asignado para poder leerse, no solo estar autenticado.
--    Una cuenta pendiente no ve absolutamente nada.

alter table usuarios alter column rol drop not null;
alter table usuarios alter column rol drop default;

create or replace function public.crear_usuario_pendiente()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.usuarios (nombre, email, auth_user_id, rol)
  values (
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.id,
    null
  )
  on conflict (auth_user_id) where auth_user_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_usuario_pendiente();

-- Catálogos de trabajo: ahora exigen rol asignado, no solo autenticación.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'aseguradoras', 'desarmaderos', 'registros_automotores', 'tipos_baja'
  ])
  loop
    execute format('drop policy if exists "%1$s_select" on %1$s;', t);
    execute format(
      'create policy "%1$s_select" on %1$s for select using (rol_del_usuario_actual() is not null);',
      t
    );
  end loop;
end $$;

-- usuarios: solo se puede leer si ya tenés un rol asignado (evita que una
-- cuenta pendiente vea la lista de responsables o quién trabaja acá).
drop policy if exists "usuarios_select" on usuarios;
create policy "usuarios_select" on usuarios for select
  using (rol_del_usuario_actual() is not null);
