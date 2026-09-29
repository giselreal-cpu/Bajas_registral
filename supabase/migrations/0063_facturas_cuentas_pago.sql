-- Cuenta(s) bancaria(s) a donde tiene que transferir el receptor de la
-- factura (compañía o desarmadero) cuando la forma de pago es
-- "Transferencia". Una factura puede pagarse a una sola cuenta (monto
-- completo) o repartida en varias (fraccionado) — por eso es una tabla
-- aparte y no una columna más en `facturas`, mismo criterio que
-- cobros/notas_credito.

create table if not exists facturas_cuentas_pago (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id) on delete cascade,
  cuenta_bancaria text not null,
  monto numeric(12,2) not null check (monto > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_facturas_cuentas_pago_factura on facturas_cuentas_pago(factura_id);

-- RLS: mismo criterio que facturas/cobros/notas_credito (0028_rentabilidad.sql)
-- — solo operador/administrador, compañía no tiene ningún acceso.
alter table facturas_cuentas_pago enable row level security;

create policy "facturas_cuentas_pago_select" on facturas_cuentas_pago for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "facturas_cuentas_pago_insert" on facturas_cuentas_pago for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "facturas_cuentas_pago_update" on facturas_cuentas_pago for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "facturas_cuentas_pago_delete" on facturas_cuentas_pago for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
