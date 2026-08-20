-- =====================================================================
-- Módulo financiero (Fase 2): anticipos aplicables a cualquier factura
-- pendiente del mismo tercero, notas de crédito que ajustan una factura
-- ya emitida sin borrarla, y control documental atado al estado
-- financiero (no se libera "Envío de documentación Cía" hasta que el
-- caso esté saldado, salvo excepción autorizada por un administrador).
-- Mismo criterio que 0028: sin acceso de "compania" a nada de esto.
-- =====================================================================

-- =====================================================================
-- 1. Anticipos: saldo a favor de un tercero (compañía o desarmadero),
-- no atado a un caso puntual — se aplica contra cualquier factura
-- pendiente suya.
-- =====================================================================

create table if not exists anticipos (
  id uuid primary key default gen_random_uuid(),
  tipo_receptor text not null check (tipo_receptor in ('compania', 'desarmadero')),
  receptor_id uuid not null,
  monto numeric(12,2) not null check (monto > 0),
  saldo_disponible numeric(12,2) not null check (saldo_disponible >= 0 and saldo_disponible <= monto),
  fecha date not null default current_date,
  observacion text,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_anticipos_receptor on anticipos(tipo_receptor, receptor_id);

-- Traza de qué anticipo financió un cobro (para distinguir "cobro real"
-- de "cobro cubierto con saldo a favor" en la cuenta corriente).
alter table cobros add column if not exists anticipo_id uuid references anticipos(id);

-- =====================================================================
-- 2. Notas de crédito: ajustan una factura ya emitida sin borrarla.
-- =====================================================================

create table if not exists notas_credito (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id),
  monto numeric(12,2) not null check (monto > 0),
  motivo text not null,
  fecha date not null default current_date,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_notas_credito_factura on notas_credito(factura_id);

-- =====================================================================
-- 3. Control documental: excepción para liberar "Envío de documentación
-- Cía" sin que el caso esté saldado (requiere administrador + motivo).
-- =====================================================================

alter table bitacora add column if not exists excepcion_financiera boolean not null default false;
alter table bitacora add column if not exists motivo_excepcion text;

-- =====================================================================
-- 4. Vista de cuenta corriente: se recrea sumando la rama de notas de
-- crédito (crédito, igual que un cobro).
-- =====================================================================

create or replace view cuenta_corriente as
select
  f.tipo_receptor,
  f.receptor_id,
  f.caso_id,
  f.fecha_emision as fecha,
  'factura'::text as concepto,
  f.monto_total as debito,
  0::numeric(12,2) as credito,
  f.id as factura_id,
  f.numero_factura,
  f.estado
from facturas f
union all
select
  f.tipo_receptor,
  f.receptor_id,
  f.caso_id,
  c.fecha,
  'cobro'::text as concepto,
  0::numeric(12,2) as debito,
  c.monto as credito,
  f.id as factura_id,
  f.numero_factura,
  f.estado
from cobros c
join facturas f on f.id = c.factura_id
union all
select
  f.tipo_receptor,
  f.receptor_id,
  f.caso_id,
  n.fecha,
  'nota_credito'::text as concepto,
  0::numeric(12,2) as debito,
  n.monto as credito,
  f.id as factura_id,
  f.numero_factura,
  f.estado
from notas_credito n
join facturas f on f.id = n.factura_id;

-- =====================================================================
-- 5. RLS: mismo criterio que el resto del módulo financiero — solo
-- operador/administrador, "compania" sin ningún acceso.
-- =====================================================================

alter table anticipos enable row level security;
alter table notas_credito enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['anticipos', 'notas_credito'])
  loop
    execute format(
      'create policy "%1$s_select" on %1$s for select using (rol_del_usuario_actual() in (''operador'',''administrador''));',
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
