-- Función auxiliar para poder pedirle a la secuencia de numero_caso "el
-- próximo número" desde el código de la aplicación (supabase-js no puede
-- llamar nextval() directo, solo funciones).

create or replace function siguiente_numero_caso()
returns integer
language sql
security definer
as $$
  select nextval(pg_get_serial_sequence('casos', 'numero_caso'))::integer;
$$;

grant execute on function siguiente_numero_caso() to authenticated;
