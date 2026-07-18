-- Campos necesarios para la Autorización de Traslado (que pide número de
-- póliza/ítem, y el origen/destino del traslado con más detalle de
-- ubicación que lo que ya teníamos).

alter table casos add column if not exists numero_poliza text;
alter table casos add column if not exists item_poliza text;

alter table asegurados add column if not exists entre_calles text;
alter table asegurados add column if not exists partido text;

alter table desarmaderos add column if not exists provincia text;
