-- Un usuario de compañía no debe ver el listado de las demás
-- aseguradoras (clientes de Oltra): solo la suya. Operador y
-- administrador siguen viendo todas. Antes la lectura estaba abierta a
-- cualquiera con un rol asignado (0006_aprobacion_pendiente.sql).

drop policy if exists "aseguradoras_select" on aseguradoras;
create policy "aseguradoras_select" on aseguradoras for select
  using (
    rol_del_usuario_actual() in ('operador', 'administrador')
    or id = aseguradora_del_usuario_actual()
  );
