-- Acceso público (sin login) para desarmaderos, mismo patrón que
-- gestores: un token fijo por desarmadero para el hub con todos sus
-- casos asignados (/desarmadero/<token_acceso>), y un token por caso
-- para el enlace puntual (/d/<token_desarmadero>). Todo el acceso se
-- resuelve server-side con la service role key (como /g/<token> y
-- /gestor/<token>), así que no hace falta RLS nueva.
alter table desarmaderos
  add column if not exists token_acceso uuid unique default gen_random_uuid();

alter table casos
  add column if not exists token_desarmadero uuid not null default gen_random_uuid() unique;
