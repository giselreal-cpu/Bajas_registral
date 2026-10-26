-- Estado de cada desarmadero: con los desarmaderos nuevos que se van
-- sumando conviene poder dar de baja uno sin borrarlo (tiene casos y
-- facturas históricas). Un desarmadero inactivo deja de ofrecerse al asignar
-- uno a un caso, pero sigue visible en los casos que ya lo tienen y en los
-- filtros.

alter table desarmaderos
  add column if not exists estado text not null default 'activo'
  check (estado in ('activo', 'inactivo'));
