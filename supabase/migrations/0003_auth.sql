-- Autenticación básica.
-- Vincula cada fila de `usuarios` (el catálogo de responsables) con una
-- cuenta real de Supabase Auth, y reemplaza las políticas RLS permisivas
-- ("cualquiera puede todo") por políticas que exigen estar autenticado.

alter table usuarios add column if not exists auth_user_id uuid references auth.users(id);
create unique index if not exists usuarios_auth_user_id_key
  on usuarios(auth_user_id) where auth_user_id is not null;

-- Reemplazar las políticas "allow_all_*" por políticas "solo autenticados".
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'aseguradoras','asegurados','vehiculos','desarmaderos',
    'registros_automotores','tipos_baja','usuarios',
    'casos','bitacora','documentos'
  ])
  loop
    execute format('drop policy if exists "allow_all_%1$s" on %1$s;', t);
    execute format(
      'drop policy if exists "authenticated_only_%1$s" on %1$s;
       create policy "authenticated_only_%1$s" on %1$s
         for all
         using (auth.role() = ''authenticated'')
         with check (auth.role() = ''authenticated'');',
      t
    );
  end loop;
end $$;
