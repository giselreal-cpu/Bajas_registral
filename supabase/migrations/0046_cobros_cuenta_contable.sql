-- Los cobros ya podían llevar caja_id (0041), pero no cuenta contable:
-- al registrar un cobro contra una factura no había forma de elegir a
-- qué caja entró esa plata ni contra qué cuenta contable imputarla. Se
-- agrega acá para que el Libro de movimientos pueda armarse a partir de
-- cobros reales (plata efectivamente entrada) en vez de los movimientos
-- de ingreso devengados.

alter table cobros
  add column if not exists cuenta_contable_id uuid references cuentas_contables(id) on delete set null;
