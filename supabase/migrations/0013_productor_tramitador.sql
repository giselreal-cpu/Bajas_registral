-- Datos del productor de la póliza y del trámitador designado por la
-- compañía para este caso.

alter table casos add column if not exists productor_nombre text;
alter table casos add column if not exists productor_contacto text;
alter table casos add column if not exists tramitador_nombre text;
alter table casos add column if not exists tramitador_email text;
