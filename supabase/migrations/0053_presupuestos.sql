-- Presupuesto vs. real: monto esperado por cuenta contable y mes, para
-- compararlo contra lo efectivamente cargado ese mes (mismo criterio
-- de "Resumen por cuenta" — devengado, aprobado, no anulado, solo
-- ARS). Un presupuesto por cuenta+mes, no por centro de costo — cruzar
-- cuenta x centro de costo x mes sería una matriz mucho más grande sin
-- pedido concreto para justificarla todavía.

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  cuenta_contable_id uuid not null references cuentas_contables(id) on delete cascade,
  -- Formato 'AAAA-MM'.
  mes text not null,
  monto numeric(12,2) not null check (monto >= 0),
  creado_por uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_presupuestos_cuenta_mes unique (cuenta_contable_id, mes)
);

create index if not exists idx_presupuestos_mes on presupuestos(mes);

alter table presupuestos enable row level security;

-- Mismo criterio que el resto del módulo financiero: operador puede
-- ver, solo administrador puede cargar/editar/borrar presupuestos.
create policy "presupuestos_select" on presupuestos for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));

create policy "presupuestos_insert" on presupuestos for insert
  with check (rol_del_usuario_actual() = 'administrador');

create policy "presupuestos_update" on presupuestos for update
  using (rol_del_usuario_actual() = 'administrador')
  with check (rol_del_usuario_actual() = 'administrador');

create policy "presupuestos_delete" on presupuestos for delete
  using (rol_del_usuario_actual() = 'administrador');
