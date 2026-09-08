-- Los anticipos son plata real que ya entró (un tercero paga por
-- adelantado, antes de que exista una factura contra qué aplicarla),
-- pero hasta ahora no tenían caja ni cuenta contable — esa plata nunca
-- aparecía en el Libro de movimientos ni en Liquidez. Se agrega acá;
-- el cobro que se genera al APLICAR un anticipo contra una factura
-- sigue sin caja propia a propósito (no es plata nueva, ya se contó
-- acá al recibir el anticipo — contarla de nuevo sería duplicarla).

alter table anticipos
  add column if not exists caja_id uuid references cajas(id) on delete set null,
  add column if not exists cuenta_contable_id uuid references cuentas_contables(id) on delete set null;
