-- Criterio de IVA del cierre mensual:
--  * INGRESOS: el IVA se descuenta solo cuando la plata entra por una caja de
--    BANCO; lo que entra por Caja pesos (efectivo) cuenta por el monto completo.
--  * EGRESOS: el IVA se descuenta solo si el gasto es con FACTURA A (se
--    marca con la nueva columna factura_a); si no, cuenta por el monto completo.
-- Para eso el cierre necesita saber por qué caja se movió cada cobro/pago
-- (caja_pago_id, que en un cobro hecho con un anticipo es la caja del anticipo)
-- y, para lo que todavía no se cobró/pagó, la forma de pago prevista de la
-- factura y la caja elegida en el gasto. Solo se agregan columnas al final de
-- las vistas; no se toca ningún dato.

alter table movimientos_caso add column if not exists factura_a boolean not null default false;
alter table movimientos_generales add column if not exists factura_a boolean not null default false;

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
  coalesce(c.fecha_cierre, f.fecha_emision) as fecha_devengo,
  f.fecha_vencimiento,
  'ARS'::text as moneda,
  f.monto_total as monto_total,
  coalesce(agg.neto, f.monto_total) as monto_neto,
  f.monto_total - coalesce(agg.neto, f.monto_total) as iva,
  f.retenciones as retenciones,
  false as anulado,
  (c.fecha_cierre is null) as caso_abierto,
  f.forma_pago,
  null::uuid as caja_prevista_id,
  false as factura_a
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
  coalesce(c.fecha_cierre, m.fecha),
  null,
  m.moneda,
  m.monto,
  round(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100), 2),
  m.monto - round(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100), 2),
  m.retenciones,
  m.anulado,
  (c.fecha_cierre is null),
  null,
  m.caja_id,
  m.factura_a
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
  g.anulado,
  false,
  null,
  g.caja_id,
  g.factura_a
from movimientos_generales g
left join cuentas_contables cc on cc.id = g.cuenta_contable_id

union all

select
  'ing:' || m.id::text,
  'movimiento_ingreso',
  m.id,
  'ingreso',
  m.caso_id,
  c.aseguradora_id,
  null,
  null,
  null,
  cm.nombre,
  'Ingreso sin facturar',
  null,
  coalesce(c.fecha_cierre, m.fecha),
  null,
  m.moneda,
  m.monto,
  round(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100), 2),
  m.monto - round(m.monto / (1 + coalesce(m.iva_alicuota, 21) / 100), 2),
  m.retenciones,
  m.anulado,
  (c.fecha_cierre is null),
  null,
  null,
  false
from movimientos_caso m
join conceptos_movimiento cm on cm.id = m.concepto_id and cm.tipo = 'ingreso'
join casos c on c.id = m.caso_id
where m.aprobado and m.factura_id is null;

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
  co.anulado,
  coalesce(co.caja_id, (select an.caja_id from anticipos an where an.id = co.anticipo_id)) as caja_pago_id
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
  n.anulado,
  null
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
  m.anulado,
  m.caja_id
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
  g.anulado,
  g.caja_id
from movimientos_generales g;
