-- Datos de contacto adicionales para el catálogo de gestores de campo:
-- dirección, email, y zona de cobertura (texto libre — barrios/partidos
-- donde trabaja, no un catálogo cerrado).

alter table gestores add column if not exists direccion text;
alter table gestores add column if not exists email text;
alter table gestores add column if not exists zona_cobertura text;
