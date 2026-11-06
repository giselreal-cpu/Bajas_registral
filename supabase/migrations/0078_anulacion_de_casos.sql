-- Anulación de casos: cuando un caso no avanza (el asegurado decide arreglar
-- por su cuenta, por otras causas, etc.) se anula en vez de borrarlo, así no
-- se saltea el número correlativo y queda registrado por qué. Un caso anulado
-- conserva su estado, su bitácora y sus movimientos; se puede reactivar.

alter table casos
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references usuarios(id) on delete set null;

create index if not exists idx_casos_anulado on casos (anulado) where anulado = true;
