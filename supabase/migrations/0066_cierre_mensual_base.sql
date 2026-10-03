-- =====================================================================
-- Cierre mensual (etapa 1): base de datos del módulo.
-- Todo es ADITIVO: no se modifica ni se borra ningún dato existente, y
-- las pantallas actuales (Libro, Liquidez, Panel, Cuenta corriente)
-- siguen leyendo lo mismo que antes.
--
-- Criterio central: DEVENGADO (resultado, por fecha del comprobante)
-- separado de CAJA (liquidez, por fecha en que la plata entra/sale de
-- una caja). Las vistas de abajo presentan lo que ya existe con el
-- modelo comprobantes / aplicaciones / movimientos de tesorería.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IVA y retenciones. Los montos cargados hoy YA INCLUYEN IVA: el
--    total es lo existente y el neto se calcula total / (1 + alícuota).
-- ---------------------------------------------------------------------

alter table conceptos_movimiento
  add column if not exists iva_alicuota numeric(5,2) not null default 21 check (iva_alicuota >= 0);

-- Foto de la alícuota al momento de cargar el movimiento (así cambiarla
-- después en el concepto no reescribe meses ya cerrados).
alter table movimientos_caso
  add column if not exists iva_alicuota numeric(5,2) check (iva_alicuota >= 0),
  add column if not exists retenciones numeric(12,2) not null default 0 check (retenciones >= 0);

alter table movimientos_generales
  add column if not exists iva_alicuota numeric(5,2) not null default 21 check (iva_alicuota >= 0),
  add column if not exists retenciones numeric(12,2) not null default 0 check (retenciones >= 0);

alter table facturas
  add column if not exists retenciones numeric(12,2) not null default 0 check (retenciones >= 0);

update movimientos_caso m
set iva_alicuota = cm.iva_alicuota
from conceptos_movimiento cm
where cm.id = m.concepto_id
  and m.iva_alicuota is null;

-- ---------------------------------------------------------------------
-- 2. Fecha de pago de los egresos. Hasta ahora `fecha` servía a la vez
--    de fecha de devengo y de fecha de pago, así que no se podía saber
--    si un egreso de un mes se pagó en ese mismo mes o después. Los ya
--    pagados se completan con su `fecha` (único dato disponible).
-- ---------------------------------------------------------------------

alter table movimientos_caso add column if not exists fecha_pago date;

update movimientos_caso
set fecha_pago = fecha
where pagado = true
  and fecha_pago is null;

create index if not exists idx_movimientos_caso_fecha_pago on movimientos_caso(fecha_pago);

create or replace function movimientos_caso_defaults() returns trigger
language plpgsql as $$
begin
  if new.iva_alicuota is null then
    select iva_alicuota into new.iva_alicuota from conceptos_movimiento where id = new.concepto_id;
  end if;

  if new.pagado then
    if new.fecha_pago is null then
      -- Cargado ya pagado: se asume pagado en su fecha. Marcado pagado
      -- después (estaba pendiente): se paga hoy.
      if tg_op = 'UPDATE' and not old.pagado then
        new.fecha_pago := current_date;
      else
        new.fecha_pago := new.fecha;
      end if;
    end if;
  else
    new.fecha_pago := null;
  end if;

  return new;
end $$;

drop trigger if exists trg_movimientos_caso_defaults on movimientos_caso;
create trigger trg_movimientos_caso_defaults
  before insert or update on movimientos_caso
  for each row execute function movimientos_caso_defaults();

-- ---------------------------------------------------------------------
-- 3. Cajas: desde cuándo vale el saldo inicial.
-- ---------------------------------------------------------------------

alter table cajas add column if not exists fecha_saldo_inicial date;

-- ---------------------------------------------------------------------
-- 4. Transferencias internas entre cajas (depósito de efectivo en el
--    banco, extracción, pase entre cuentas). NO son cobros ni pagos:
--    no tocan el resultado ni el Saldo de Cajas total.
-- ---------------------------------------------------------------------

create table if not exists transferencias_internas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  caja_origen_id uuid not null references cajas(id),
  caja_destino_id uuid not null references cajas(id),
  monto numeric(12,2) not null check (monto > 0),
  referencia text,
  creado_por uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  anulado boolean not null default false,
  anulado_motivo text,
  anulado_at timestamptz,
  anulado_por uuid references usuarios(id) on delete set null,
  constraint transferencias_cajas_distintas check (caja_origen_id <> caja_destino_id)
);

create index if not exists idx_transferencias_internas_fecha on transferencias_internas(fecha);

alter table transferencias_internas enable row level security;

create policy "transferencias_internas_select" on transferencias_internas for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "transferencias_internas_insert" on transferencias_internas for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "transferencias_internas_update" on transferencias_internas for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));

-- ---------------------------------------------------------------------
-- 5. Cierre con snapshot. La fila de cierres_mensuales sigue siendo el
--    candado de siempre (existe = mes cerrado); ahora además guarda el
--    snapshot de totales y detalle al momento de cerrar. Reabrir borra
--    la fila (como hasta ahora) pero deja registro en el historial, con
--    motivo obligatorio y el snapshot que había.
-- ---------------------------------------------------------------------

alter table cierres_mensuales add column if not exists snapshot jsonb;

create policy "cierres_mensuales_update" on cierres_mensuales for update
  using (rol_del_usuario_actual() = 'administrador')
  with check (rol_del_usuario_actual() = 'administrador');

create table if not exists cierres_mensuales_historial (
  id uuid primary key default gen_random_uuid(),
  mes text not null,
  accion text not null check (accion in ('cerrar', 'reabrir', 'arqueo', 'transferencia')),
  usuario_id uuid references usuarios(id) on delete set null,
  motivo text,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cierres_historial_mes on cierres_mensuales_historial(mes);

alter table cierres_mensuales_historial enable row level security;

create policy "cierres_historial_select" on cierres_mensuales_historial for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "cierres_historial_insert" on cierres_mensuales_historial for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));

-- Saldo REAL por caja (extracto bancario / arqueo físico) que se exige
-- cargar para cerrar el mes. Se puede cargar antes de cerrar.
create table if not exists cierres_saldos_declarados (
  id uuid primary key default gen_random_uuid(),
  mes text not null,
  caja_id uuid not null references cajas(id),
  tipo text not null check (tipo in ('extracto', 'arqueo')),
  saldo_declarado numeric(14,2) not null,
  declarado_por uuid references usuarios(id) on delete set null,
  declarado_at timestamptz not null default now(),
  constraint uq_saldo_declarado_mes_caja unique (mes, caja_id)
);

alter table cierres_saldos_declarados enable row level security;

create policy "saldos_declarados_select" on cierres_saldos_declarados for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "saldos_declarados_insert" on cierres_saldos_declarados for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "saldos_declarados_update" on cierres_saldos_declarados for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));

-- ---------------------------------------------------------------------
-- 6. Vistas. `security_invoker` hace que respeten el RLS de las tablas
--    de abajo (compañía no tiene acceso a nada de esto).
-- ---------------------------------------------------------------------

-- Cajas agrupadas como pide el reporte: Bancos / Efectivo.
create or replace view v_cajas_liquidez with (security_invoker = true) as
select
  c.id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.saldo_inicial,
  c.fecha_saldo_inicial,
  c.activa,
  case when c.tipo in ('banco', 'financiera') then 'bancos' else 'efectivo' end as grupo
from cajas c;

-- COMPROBANTES: lo que se devenga. Ingresos = facturas internas (el
-- comprobante, no el movimiento suelto); egresos = movimientos de
-- egreso de caso y movimientos generales.
create or replace view v_comprobantes with (security_invoker = true) as
select
  'fac:' || f.id::text as comprobante_id,
  'factura'::text as origen,
  f.id as origen_id,
  'ingreso'::text as tipo,
  f.caso_id,
  c.aseguradora_id,
  f.tipo_receptor as contraparte_tipo,
  f.receptor_id as contraparte_id,
  coalesce(a.nombre, d.nombre) as contraparte_nombre,
  coalesce(agg.categorias, 'Facturación') as categoria,
  'Factura interna'::text as tipo_comprobante,
  f.numero_factura::text as numero,
  f.fecha_emision as fecha_devengo,
  f.fecha_vencimiento,
  'ARS'::text as moneda,
  f.monto_total as monto_total,
  coalesce(agg.neto, f.monto_total) as monto_neto,
  f.monto_total - coalesce(agg.neto, f.monto_total) as iva,
  f.retenciones as retenciones,
  false as anulado
from facturas f
join casos c on c.id = f.caso_id
left join aseguradoras a on f.tipo_receptor = 'compania' and a.id = f.receptor_id
left join desarmaderos d on f.tipo_receptor = 'desarmadero' and d.id = f.receptor_id
left join lateral (
  select
    round(sum(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100)), 2) as neto,
    string_agg(distinct cm.nombre, ', ') as categorias
  from movimientos_caso m
  join conceptos_movimiento cm on cm.id = m.concepto_id
  where m.factura_id = f.id and not m.anulado
) agg on true

union all

select
  'mov:' || m.id::text,
  'movimiento_caso',
  m.id,
  'egreso',
  m.caso_id,
  c.aseguradora_id,
  null,
  null,
  null,
  cm.nombre,
  'Gasto de caso',
  null,
  m.fecha,
  null,
  m.moneda,
  m.monto,
  round(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100), 2),
  m.monto - round(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100), 2),
  m.retenciones,
  m.anulado
from movimientos_caso m
join conceptos_movimiento cm on cm.id = m.concepto_id and cm.tipo = 'egreso'
join casos c on c.id = m.caso_id
where m.aprobado

union all

select
  'gen:' || g.id::text,
  'movimiento_general',
  g.id,
  g.tipo,
  null,
  null,
  null,
  null,
  null,
  coalesce(cc.nombre, 'Movimiento general'),
  'Movimiento general',
  null,
  g.fecha,
  null,
  g.moneda,
  g.monto,
  round(g.monto / (1 + g.iva_alicuota / 100), 2),
  g.monto - round(g.monto / (1 + g.iva_alicuota / 100), 2),
  g.retenciones,
  g.anulado
from movimientos_generales g
left join cuentas_contables cc on cc.id = g.cuenta_contable_id;

-- APLICACIONES: qué cobro/pago/nota de crédito cancela (total o
-- parcialmente) a qué comprobante. `es_anticipo` = cobro generado al
-- aplicar un anticipo (cancela deuda pero NO mueve caja: la plata ya
-- entró cuando se recibió el anticipo).
create or replace view v_aplicaciones with (security_invoker = true) as
select
  'cob:' || co.id::text as aplicacion_id,
  'fac:' || co.factura_id::text as comprobante_id,
  'cobro'::text as clase,
  co.fecha,
  co.monto,
  co.caja_id,
  (co.anticipo_id is not null) as es_anticipo,
  co.moneda,
  co.medio_pago as medio,
  co.anulado
from cobros co

union all

select
  'nc:' || n.id::text,
  'fac:' || n.factura_id::text,
  'nota_credito',
  n.fecha,
  n.monto,
  null,
  false,
  'ARS',
  null,
  n.anulado
from notas_credito n

union all

select
  'pag:' || m.id::text,
  'mov:' || m.id::text,
  'pago',
  m.fecha_pago,
  m.monto,
  m.caja_id,
  false,
  m.moneda,
  null,
  m.anulado
from movimientos_caso m
join conceptos_movimiento cm on cm.id = m.concepto_id and cm.tipo = 'egreso'
where m.aprobado and m.pagado and m.fecha_pago is not null

union all

select
  'pag:gen:' || g.id::text,
  'gen:' || g.id::text,
  case when g.tipo = 'ingreso' then 'cobro' else 'pago' end,
  g.fecha,
  g.monto,
  g.caja_id,
  false,
  g.moneda,
  null,
  g.anulado
from movimientos_generales g;

-- MOVIMIENTOS DE TESORERÍA: el libro de caja unificado. Cada fila es
-- plata que entra o sale de una caja. Las transferencias internas
-- aparecen como una salida y una entrada con `es_transferencia_interna`
-- y el mismo `transferencia_par_id`.
create or replace view v_movimientos_tesoreria with (security_invoker = true) as
select
  'cob:' || co.id::text as movimiento_id,
  co.caja_id,
  co.fecha,
  co.monto,
  'entrada'::text as sentido,
  co.medio_pago as medio,
  null::text as referencia,
  'cobro'::text as origen,
  'fac:' || co.factura_id::text as comprobante_id,
  false as es_transferencia_interna,
  null::uuid as transferencia_par_id
from cobros co
where not co.anulado and co.caja_id is not null

union all

select
  'ant:' || a.id::text,
  a.caja_id,
  a.fecha,
  a.monto,
  'entrada',
  null,
  a.observacion,
  'anticipo',
  null,
  false,
  null
from anticipos a
where a.caja_id is not null

union all

select
  'pag:' || m.id::text,
  m.caja_id,
  m.fecha_pago,
  m.monto,
  'salida',
  null,
  m.observacion,
  'pago',
  'mov:' || m.id::text,
  false,
  null
from movimientos_caso m
join conceptos_movimiento cm on cm.id = m.concepto_id and cm.tipo = 'egreso'
where m.aprobado and m.pagado and not m.anulado and m.caja_id is not null and m.fecha_pago is not null

union all

select
  'gen:' || g.id::text,
  g.caja_id,
  g.fecha,
  g.monto,
  case when g.tipo = 'ingreso' then 'entrada' else 'salida' end,
  null,
  g.descripcion,
  'movimiento_general',
  'gen:' || g.id::text,
  false,
  null
from movimientos_generales g
where not g.anulado and g.caja_id is not null

union all

select
  'trf-s:' || t.id::text,
  t.caja_origen_id,
  t.fecha,
  t.monto,
  'salida',
  null,
  t.referencia,
  'transferencia_interna',
  null,
  true,
  t.id
from transferencias_internas t
where not t.anulado

union all

select
  'trf-e:' || t.id::text,
  t.caja_destino_id,
  t.fecha,
  t.monto,
  'entrada',
  null,
  t.referencia,
  'transferencia_interna',
  null,
  true,
  t.id
from transferencias_internas t
where not t.anulado;
