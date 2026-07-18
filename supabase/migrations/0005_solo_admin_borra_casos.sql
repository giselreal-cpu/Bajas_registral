-- Antes, tanto "operador" como "administrador" podían eliminar un caso.
-- A partir de ahora, borrar un caso queda reservado solo al rol
-- "administrador".

drop policy if exists "casos_delete" on casos;
create policy "casos_delete" on casos for delete
  using (rol_del_usuario_actual() = 'administrador');
