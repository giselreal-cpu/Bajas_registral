-- Panel, Análisis y la ficha del caso suman "monto" de movimientos_caso/
-- movimientos_generales/cobros/anticipos sin distinguir moneda — si
-- alguna vez se usa con normalidad una caja en USD (ya existen: "Caja
-- en USD", "Caja de Seguridad en USD"), esos montos se sumarían junto
-- con los de pesos como si fueran lo mismo. Liquidez ya lo hace bien
-- (agrupa por caja, cada una con su moneda) — el resto de los reportes
-- necesita este campo para poder hacer lo mismo.
--
-- No es un cálculo aparte: se completa solo con la moneda de la caja
-- elegida al cargar el movimiento (ver los endpoints de creación), y
-- default 'ARS' para lo que no tiene caja asignada, igual que el resto
-- del esquema asume hoy implícitamente.

alter table movimientos_caso
  add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));

alter table movimientos_generales
  add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));

alter table cobros
  add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));

alter table anticipos
  add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS', 'USD'));
