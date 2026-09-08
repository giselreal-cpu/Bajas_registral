-- Cierre de período (manual, por mes): una vez cerrado un mes, no se
-- puede crear, editar, anular ni borrar ningún movimiento financiero
-- (movimientos_caso, movimientos_generales, cobros, notas_credito,
-- facturas, anticipos) con fecha dentro de ese mes — ni siquiera un
-- administrador, hay que reabrir el período primero (acción reversible
-- y también reservada a administrador). Antes cualquiera podía tocar
-- un mes ya reportado sin ningún aviso.

create table if not exists cierres_mensuales (
  id uuid primary key default gen_random_uuid(),
  -- Formato 'AAAA-MM'.
  mes text not null unique,
  cerrado_por uuid references usuarios(id) on delete set null,
  cerrado_at timestamptz not null default now()
);

alter table cierres_mensuales enable row level security;

-- Mismo criterio que el resto del módulo financiero: operador puede
-- leer (para saber si un período está cerrado antes de intentar cargar
-- algo), pero cerrar/reabrir un período queda reservado a
-- administrador — se valida también en el backend, esto es defensa en
-- profundidad.
create policy "cierres_mensuales_select" on cierres_mensuales for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

create policy "cierres_mensuales_insert" on cierres_mensuales for insert
  with check (rol_del_usuario_actual() = 'administrador');

create policy "cierres_mensuales_delete" on cierres_mensuales for delete
  using (rol_del_usuario_actual() = 'administrador');
