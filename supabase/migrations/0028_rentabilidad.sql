-- =====================================================================
-- Módulo financiero (Fase 1): trazabilidad de costo/ganancia por caso,
-- facturación y cobranza internas (no hay integración fiscal, Oltra no
-- usa Contabilium), configuración comercial por aseguradora y cuenta
-- corriente por tercero. Adaptado de un sistema propio del usuario
-- (tf3040-plataforma) a la granularidad de este proyecto: acá no hay
-- una tabla "operaciones" aparte, cada `caso` YA es esa unidad.
--
-- Todo lo de acá es información interna de costos/ganancia de Oltra:
-- a diferencia del resto de las tablas, el rol "compania" no tiene
-- NINGÚN acceso (ni lectura), a propósito.
-- =====================================================================

-- =====================================================================
-- 1. Configuración comercial por aseguradora
-- Tabla separada (no columnas nuevas en `aseguradoras`) para que
-- pueda tener su propia RLS sin exponer los % a `compania`, que sí
-- puede seguir leyendo `aseguradoras` normalmente.
-- =====================================================================

create table if not exists comercial_aseguradora (
  id uuid primary key default gen_random_uuid(),
  aseguradora_id uuid not null unique references aseguradoras(id) on delete cascade,
  porcentaje_desarmadero numeric(5,2),
  porcentaje_compania numeric(5,2),
  base_calculo_compania text check (base_calculo_compania in ('valor_infoauto', 'suma_asegurada')),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 2. Valor InfoAuto: valor de referencia de la unidad, como
-- suma_asegurada.
-- =====================================================================

alter table casos add column if not exists valor_infoauto numeric(12,2);

-- =====================================================================
-- 3. Conceptos de movimiento: catálogo abierto (mismo patrón que
-- tipos_baja), cada uno tipado como ingreso o egreso.
-- =====================================================================

create table if not exists conceptos_movimiento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  created_at timestamptz not null default now(),
  constraint uq_conceptos_movimiento_nombre_tipo unique (nombre, tipo)
);

insert into conceptos_movimiento (nombre, tipo) values
  ('Cobro a la aseguradora', 'ingreso'),
  ('Cobro al desarmadero', 'ingreso'),
  ('Informe de Ingeniero', 'ingreso'),
  ('Pago a la compañía', 'egreso'),
  ('Honorarios por Gestoría', 'egreso'),
  ('Informe de dominio', 'egreso'),
  ('Informe de multas', 'egreso'),
  ('Informe de patentes', 'egreso'),
  ('Informe de Ingeniero', 'egreso'),
  ('Correo / moto envío', 'egreso'),
  ('Otro', 'egreso')
on conflict do nothing;

-- =====================================================================
-- 4. Movimientos por caso: la trazabilidad en sí. Un caso puede tener
-- cualquier cantidad de movimientos (varios informes, pagos parciales,
-- etc.). `factura_id` se completa cuando el movimiento queda agrupado
-- en un comprobante.
-- =====================================================================

create table if not exists movimientos_caso (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id) on delete cascade,
  concepto_id uuid not null references conceptos_movimiento(id),
  monto numeric(12,2) not null check (monto >= 0),
  fecha date not null default current_date,
  observacion text,
  factura_id uuid,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_caso_caso on movimientos_caso(caso_id);
create index if not exists idx_movimientos_caso_factura on movimientos_caso(factura_id);

-- =====================================================================
-- 5. Facturas: comprobante interno (no fiscal). Agrupa uno o varios
-- movimientos de un caso hacia un receptor (compañía o desarmadero).
-- receptor_id es polimórfico (apunta a aseguradoras.id o
-- desarmaderos.id según tipo_receptor) — sin FK física, validado en
-- la API, mismo criterio que usa el sistema de origen.
-- =====================================================================

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  numero_factura serial,
  caso_id uuid not null references casos(id),
  tipo_receptor text not null check (tipo_receptor in ('compania', 'desarmadero')),
  receptor_id uuid not null,
  monto_total numeric(12,2) not null default 0,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'cobrado_parcial', 'cobrado_total')),
  fecha_emision date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_facturas_caso on facturas(caso_id);
create index if not exists idx_facturas_receptor on facturas(tipo_receptor, receptor_id);

alter table movimientos_caso add constraint fk_movimientos_caso_factura
  foreign key (factura_id) references facturas(id) on delete set null;

-- =====================================================================
-- 6. Cobros: pagos parciales o totales registrados contra una factura.
-- =====================================================================

create table if not exists cobros (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  medio_pago text,
  observacion text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cobros_factura on cobros(factura_id);

-- =====================================================================
-- 7. Vista de cuenta corriente: débitos (facturas) y créditos (cobros)
-- por tercero, para ver el saldo pendiente de cada compañía/desarmadero
-- across todos sus casos.
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
join facturas f on f.id = c.factura_id;

-- =====================================================================
-- 8. RLS: solo operador/administrador. `compania` no tiene ningún
-- acceso a estas tablas (a diferencia del resto de los catálogos).
-- =====================================================================

alter table comercial_aseguradora enable row level security;
alter table conceptos_movimiento enable row level security;
alter table movimientos_caso enable row level security;
alter table facturas enable row level security;
alter table cobros enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'comercial_aseguradora', 'conceptos_movimiento', 'movimientos_caso', 'facturas', 'cobros'
  ])
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
