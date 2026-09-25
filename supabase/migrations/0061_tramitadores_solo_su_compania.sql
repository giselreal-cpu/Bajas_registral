-- Cada compañía solo debe ver sus propios trámitadores (antes la lectura
-- estaba abierta a cualquier usuario autenticado, y en los filtros
-- aparecían los de otras aseguradoras). Operador y administrador siguen
-- viendo todos.

drop policy if exists "tramitadores_select" on tramitadores;
create policy "tramitadores_select" on tramitadores for select
  using (
    rol_del_usuario_actual() in ('operador', 'administrador')
    or aseguradora_id = aseguradora_del_usuario_actual()
  );
