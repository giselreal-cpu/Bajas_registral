-- Reemplaza el borrado físico por anulación (reversa con motivo) para
-- todo lo que ya representa plata real: egresos ya pagados, cobros,
-- notas de crédito y movimientos generales (estos últimos no tienen un
-- estado "pendiente" — existen ya como reales desde que se cargan). Lo
-- que sigue pendiente (un egreso no pagado, un ingreso todavía sin
-- facturar) se puede seguir borrando libremente, sin cambios ahí.
--
-- anulado_por sin FK a usuarios(id) con "on delete set null" evita que
-- se pierda el registro completo si el usuario se borra alguna vez —
-- mismo criterio que ya usan created_por/creado_por en el resto del
-- esquema.

alter table movimientos_caso
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references usuarios(id) on delete set null;

alter table movimientos_generales
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references usuarios(id) on delete set null;

alter table cobros
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references usuarios(id) on delete set null;

alter table notas_credito
  add column if not exists anulado boolean not null default false,
  add column if not exists anulado_motivo text,
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references usuarios(id) on delete set null;

create index if not exists idx_movimientos_caso_anulado on movimientos_caso(anulado) where anulado = true;
create index if not exists idx_cobros_anulado on cobros(anulado) where anulado = true;
