-- =====================================================================
-- Asigna "Caja pesos" a los movimientos históricos (por caso) de los
-- conceptos "Pago a la compañía", "Cobro al desarmadero" y "Honorarios
-- por Gestoría" — a pedido explícito del usuario, que confirmó que esos
-- tres tipos de movimiento pasaron por esa caja. Solo toca los que
-- todavía no tenían caja asignada (no pisa nada cargado a mano después
-- de 0041).
-- =====================================================================

update movimientos_caso mc
set caja_id = (select id from cajas where nombre = 'Caja pesos')
from conceptos_movimiento cm
where mc.concepto_id = cm.id
  and mc.caja_id is null
  and cm.nombre in ('Pago a la compañía', 'Cobro al desarmadero', 'Honorarios por Gestoría');
