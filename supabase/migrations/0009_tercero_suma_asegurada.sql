-- Datos del tercero autorizado a hacer entrega de la unidad (si no es el
-- propio asegurado quien la entrega), y la suma asegurada del caso.

alter table casos add column if not exists tercero_nombre text;
alter table casos add column if not exists tercero_dni text;
alter table casos add column if not exists tercero_contacto text;
alter table casos add column if not exists suma_asegurada numeric(14,2);
