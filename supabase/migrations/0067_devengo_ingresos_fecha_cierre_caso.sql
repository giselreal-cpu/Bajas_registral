-- El ingreso de una factura se devenga cuando CIERRA EL CASO, no cuando se
-- emite la factura: un caso cerrado en septiembre y facturado en octubre
-- pertenece al resultado y al "por cobrar" de septiembre. Si el caso
-- todavía no cerró, se usa la fecha de emisión como hasta ahora. Los
-- egresos no cambian (siguen devengándose en la fecha del movimiento).
-- Solo se redefine la vista v_comprobantes; no se toca ningún dato.

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
