alter table gestores
  add column if not exists token_acceso uuid unique default gen_random_uuid();
