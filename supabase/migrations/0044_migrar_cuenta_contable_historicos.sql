-- =====================================================================
-- Migra los movimientos de caso ya cargados (previos a 0041/0042) para
-- que tengan cuenta contable, tomando la sugerida del concepto de cada
-- uno (mismo mapeo de 0042_plan_de_cuentas_real.sql) — así aparecen en
-- el "Libro de movimientos" de /administracion con su clasificación
-- contable e importe.
--
-- A propósito NO se les asigna caja: no hay ningún dato histórico de
-- en qué caja (Efectivo, Banco Galicia, Financiera, etc.) entró o
-- salió cada uno, e inventar una ensuciaría el saldo real de Liquidez
-- por caja con plata que no sabemos por dónde pasó. Liquidez por caja
-- arranca a contar desde que existe el dato (movimientos cargados de
-- acá en adelante) — el Libro de movimientos sí los muestra a todos,
-- porque alcanza con tener cuenta o caja, no las dos.
-- =====================================================================

update movimientos_caso mc
set cuenta_contable_id = cm.cuenta_contable_id
from conceptos_movimiento cm
where mc.concepto_id = cm.id
  and mc.cuenta_contable_id is null
  and cm.cuenta_contable_id is not null;
