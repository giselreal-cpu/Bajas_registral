-- Auditoría para movimientos_generales (sueldos, alquiler, hosting,
-- etc.): hasta ahora no dejaban ningún rastro de quién cargó, editó o
-- eliminó un movimiento sin caso — a diferencia de movimientos_caso,
-- que sí queda registrado en historial_cambios por estar atado a un
-- caso. Mismo patrón que 0015_historial_cambios.sql: solo se llena
-- desde el backend, no se puede editar ni borrar una vez creado.

create table if not exists historial_movimientos_generales (
  id uuid primary key default gen_random_uuid(),
  -- on delete SET NULL (no cascade): si se borra el movimiento, la
  -- entrada de auditoría de esa eliminación tiene que sobrevivir — en
  -- cascade se borraría a sí misma junto con el resto del historial.
  movimiento_general_id uuid references movimientos_generales(id) on delete set null,
  usuario_id uuid references usuarios(id),
  tipo_cambio text not null,
  detalle text,
  created_at timestamptz not null default now()
);

create index if not exists idx_historial_mov_generales_movimiento
  on historial_movimientos_generales(movimiento_general_id);

alter table historial_movimientos_generales enable row level security;

create policy "historial_mov_generales_select" on historial_movimientos_generales for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

create policy "historial_mov_generales_insert" on historial_movimientos_generales for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
