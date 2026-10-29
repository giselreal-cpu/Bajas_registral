-- Nuevo tipo de unidad "Moto" (además de Auto/Sedán, Pickup, SUV/Furgón y
-- Camión). El tipo de vehículo del caso se elige al cargarlo y también lo
-- usa el Anexo 04 (Piezas RUDAC), así que el valor se habilita en las dos
-- tablas que lo restringen.

do $$
declare
  r record;
begin
  -- Los checks se crearon con nombre automático: se buscan por su contenido.
  for r in
    select conname, conrelid::regclass as tabla
    from pg_constraint
    where contype = 'c'
      and conrelid in ('vehiculos'::regclass, 'reglas_piezas_rudac'::regclass)
      and pg_get_constraintdef(oid) ilike '%tipo_vehiculo%'
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;

alter table vehiculos
  add constraint vehiculos_tipo_vehiculo_check
  check (tipo_vehiculo in ('Auto/Sedán', 'Pickup', 'SUV/Furgón', 'Camión', 'Moto'));

alter table reglas_piezas_rudac
  add constraint reglas_piezas_rudac_tipo_vehiculo_check
  check (tipo_vehiculo in ('Auto/Sedán', 'Pickup', 'SUV/Furgón', 'Camión', 'Moto'));
