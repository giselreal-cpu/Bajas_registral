-- Datos nuevos para poder generar la "Orden de cobro" en PDF de una
-- factura a desarmadero: fecha de vencimiento y forma de pago, cargados
-- al generar la factura. Se agrega también el concepto "Otro" de tipo
-- ingreso (hoy "Otro" solo existe para egreso) para poder cargar
-- servicios eventuales sin concepto propio, que el PDF muestra aparte
-- como "Valor otros".

alter table facturas add column if not exists fecha_vencimiento date;
alter table facturas add column if not exists forma_pago text;

insert into conceptos_movimiento (nombre, tipo) values
  ('Otro', 'ingreso')
on conflict do nothing;
