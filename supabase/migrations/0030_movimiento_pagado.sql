-- =====================================================================
-- Estado de pago para movimientos (principalmente egresos): distingue
-- un gasto ya pagado de uno todavía pendiente de pago, igual que las
-- facturas ya distinguen cobrado de pendiente. Los ingresos ignoran esta
-- columna (su seguimiento pasa por facturas/cobros).
-- =====================================================================

alter table movimientos_caso add column if not exists pagado boolean not null default false;
