-- Datos de ejemplo opcionales para poder probar el CRUD apenas se levanta
-- el proyecto. Editar/borrar según corresponda antes de usar en producción.

insert into usuarios (nombre, email) values
  ('Responsable Demo', 'responsable@ejemplo.com')
on conflict (email) do nothing;

insert into aseguradoras (nombre, cuit, contacto, email) values
  ('Aseguradora Demo S.A.', '30-00000000-0', 'Gestoría Demo', 'gestoria@aseguradorademo.com')
on conflict do nothing;
