-- =====================================================================
-- Logo por aseguradora: se usa en el encabezado del documento de
-- Autorización de retiro y traslado, junto al logo de Oltra (fijo,
-- vive en public/logo-oltra.jpg). Bucket privado, mismo patrón que
-- documentos-casos (0021_modulo_gestor.sql): todo el acceso es
-- server-side con la service role key, no hace falta ninguna policy
-- pública sobre storage.objects.
-- =====================================================================

alter table aseguradoras add column if not exists logo_path text;

insert into storage.buckets (id, name, public)
values ('logos-aseguradoras', 'logos-aseguradoras', false)
on conflict (id) do nothing;
