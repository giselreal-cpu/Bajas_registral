-- Encuesta de satisfacción (3 preguntas, 1-5 cada una + comentario
-- opcional) enviada por WhatsApp al completar "Presentación de Baja".
-- Tabla propia (no columnas en bitácora) porque es feedback del
-- cliente, un dato de negocio distinto al operativo del trámite.

create table if not exists encuestas_satisfaccion (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  calificacion_contacto int check (calificacion_contacto between 1 and 5),
  calificacion_traslado int check (calificacion_traslado between 1 and 5),
  calificacion_gestoria int check (calificacion_gestoria between 1 and 5),
  comentario text,
  respondida boolean not null default false,
  respondida_at timestamptz,
  ultimo_contacto_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_encuestas_satisfaccion_caso on encuestas_satisfaccion(caso_id);

alter table encuestas_satisfaccion enable row level security;

-- Mismo criterio que el resto de las tablas operativas: lectura para
-- cualquier autenticado, escritura para operador/administrador. El
-- enlace público /encuesta/<token> escribe con el service client (sin
-- auth.uid()), como ya hacen /g, /gr y /fb.
create policy "encuestas_satisfaccion_select" on encuestas_satisfaccion for select
  using (auth.role() = 'authenticated');
create policy "encuestas_satisfaccion_insert" on encuestas_satisfaccion for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "encuestas_satisfaccion_update" on encuestas_satisfaccion for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
