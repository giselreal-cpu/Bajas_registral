-- Roles de usuario: operador, administrador, compania.
-- "compania" queda vinculado a una aseguradora puntual (aseguradora_id) y
-- solo puede LEER los casos de esa aseguradora (y sus datos relacionados:
-- asegurado, vehículo, bitácora no interna, documentos). No puede crear ni
-- editar nada, y nunca ve eventos de bitácora marcados como internos.
-- "administrador" puede además asignar roles (CRUD de usuarios) y ve todo,
-- incluidas las observaciones internas de cualquier caso.
-- "operador" es el rol de siempre: acceso completo de lectura/escritura a
-- los casos, salvo la regla ya existente de observaciones internas
-- (solo visibles para el responsable de cada caso puntual).

alter table usuarios add column if not exists rol text not null default 'operador'
  check (rol in ('operador', 'administrador', 'compania'));
alter table usuarios add column if not exists aseguradora_id uuid references aseguradoras(id);

-- ==========================================================
-- Funciones auxiliares (SECURITY DEFINER: leen `usuarios` sin quedar
-- atrapadas por las políticas RLS de esa misma tabla).
-- ==========================================================

create or replace function usuario_actual()
returns table (id uuid, rol text, aseguradora_id uuid)
language sql security definer stable
as $$
  select id, rol, aseguradora_id from usuarios where auth_user_id = auth.uid();
$$;

create or replace function rol_del_usuario_actual()
returns text language sql security definer stable as $$
  select rol from usuario_actual();
$$;

create or replace function aseguradora_del_usuario_actual()
returns uuid language sql security definer stable as $$
  select aseguradora_id from usuario_actual();
$$;

grant execute on function usuario_actual() to authenticated;
grant execute on function rol_del_usuario_actual() to authenticated;
grant execute on function aseguradora_del_usuario_actual() to authenticated;

-- ==========================================================
-- usuarios: cualquier autenticado puede leer el listado (se necesita para
-- los combos de "responsable" en toda la app). Solo administrador puede
-- crear/editar/borrar, es decir, asignar roles.
-- ==========================================================

drop policy if exists "authenticated_only_usuarios" on usuarios;
create policy "usuarios_select" on usuarios for select
  using (auth.role() = 'authenticated');
create policy "usuarios_insert" on usuarios for insert
  with check (rol_del_usuario_actual() = 'administrador');
create policy "usuarios_update" on usuarios for update
  using (rol_del_usuario_actual() = 'administrador')
  with check (rol_del_usuario_actual() = 'administrador');
create policy "usuarios_delete" on usuarios for delete
  using (rol_del_usuario_actual() = 'administrador');

-- ==========================================================
-- Catálogos de trabajo (aseguradoras, desarmaderos, registros, tipos de
-- baja): lectura para cualquier autenticado; escritura solo para
-- operador/administrador (compania no puede tocarlos).
-- ==========================================================

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'aseguradoras', 'desarmaderos', 'registros_automotores', 'tipos_baja'
  ])
  loop
    execute format('drop policy if exists "authenticated_only_%1$s" on %1$s;', t);
    execute format(
      'create policy "%1$s_select" on %1$s for select using (auth.role() = ''authenticated'');',
      t
    );
    execute format(
      'create policy "%1$s_insert" on %1$s for insert with check (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
    execute format(
      'create policy "%1$s_update" on %1$s for update using (rol_del_usuario_actual() in (''operador'',''administrador'')) with check (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
    execute format(
      'create policy "%1$s_delete" on %1$s for delete using (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
  end loop;
end $$;

-- ==========================================================
-- asegurados y vehiculos: datos personales. compania solo ve los que
-- están vinculados a un caso de su propia aseguradora.
-- ==========================================================

drop policy if exists "authenticated_only_asegurados" on asegurados;
create policy "asegurados_select" on asegurados for select using (
  rol_del_usuario_actual() in ('operador', 'administrador')
  or exists (
    select 1 from casos c
    where c.asegurado_id = asegurados.id
      and c.aseguradora_id = aseguradora_del_usuario_actual()
  )
);
create policy "asegurados_insert" on asegurados for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "asegurados_update" on asegurados for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "asegurados_delete" on asegurados for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

drop policy if exists "authenticated_only_vehiculos" on vehiculos;
create policy "vehiculos_select" on vehiculos for select using (
  rol_del_usuario_actual() in ('operador', 'administrador')
  or exists (
    select 1 from casos c
    where c.vehiculo_id = vehiculos.id
      and c.aseguradora_id = aseguradora_del_usuario_actual()
  )
);
create policy "vehiculos_insert" on vehiculos for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "vehiculos_update" on vehiculos for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "vehiculos_delete" on vehiculos for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

-- ==========================================================
-- casos: compania solo ve (nunca escribe) los de su propia aseguradora.
-- ==========================================================

drop policy if exists "authenticated_only_casos" on casos;
create policy "casos_select" on casos for select using (
  rol_del_usuario_actual() in ('operador', 'administrador')
  or aseguradora_id = aseguradora_del_usuario_actual()
);
create policy "casos_insert" on casos for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "casos_update" on casos for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "casos_delete" on casos for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

-- ==========================================================
-- bitacora: compania ve solo eventos NO internos de casos de su
-- aseguradora, y nunca escribe. (La regla de "interna visible solo para
-- el responsable" para operador se sigue resolviendo a nivel de API,
-- como ya estaba.)
-- ==========================================================

drop policy if exists "authenticated_only_bitacora" on bitacora;
create policy "bitacora_select" on bitacora for select using (
  rol_del_usuario_actual() in ('operador', 'administrador')
  or (
    not es_interna
    and exists (
      select 1 from casos c
      where c.id = bitacora.caso_id
        and c.aseguradora_id = aseguradora_del_usuario_actual()
    )
  )
);
create policy "bitacora_insert" on bitacora for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "bitacora_update" on bitacora for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "bitacora_delete" on bitacora for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

-- ==========================================================
-- documentos: compania ve los de casos de su aseguradora, nunca escribe.
-- ==========================================================

drop policy if exists "authenticated_only_documentos" on documentos;
create policy "documentos_select" on documentos for select using (
  rol_del_usuario_actual() in ('operador', 'administrador')
  or exists (
    select 1 from casos c
    where c.id = documentos.caso_id
      and c.aseguradora_id = aseguradora_del_usuario_actual()
  )
);
create policy "documentos_insert" on documentos for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "documentos_update" on documentos for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "documentos_delete" on documentos for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
