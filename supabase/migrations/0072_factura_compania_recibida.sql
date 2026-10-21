-- Control de la factura que emite la compañía por el "Pago a la compañía":
-- si ya se recibió, con qué número y en qué fecha. Alimenta el listado de
-- Seguimiento financiero "Bajas pagadas sin factura de la compañía".
-- Solo aplica a movimientos del concepto "Pago a la compañía".

alter table movimientos_caso
  add column if not exists factura_compania_recibida boolean not null default false,
  add column if not exists factura_compania_numero text,
  add column if not exists factura_compania_fecha date;

create index if not exists idx_movimientos_caso_factura_compania
  on movimientos_caso (factura_compania_recibida)
  where factura_compania_recibida = false;
