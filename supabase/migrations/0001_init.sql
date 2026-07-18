-- Migración inicial: modelo de datos de Bajas Registrales por Siniestro
-- Ejecutar en el SQL Editor de Supabase o vía `supabase db push`.

create extension if not exists "pgcrypto";

-- ==========================================================
-- Catálogos
-- ==========================================================

create table if not exists aseguradoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text,
  contacto text,
  email text,
  telefono text,
  created_at timestamptz not null default now()
);

create table if not exists asegurados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  dni text,
  telefono text,
  email text,
  direccion text,
  created_at timestamptz not null default now()
);

create table if not exists vehiculos (
  id uuid primary key default gen_random_uuid(),
  dominio text not null unique, -- patente
  marca text,
  modelo text,
  anio int,
  chasis text,
  motor text,
  created_at timestamptz not null default now()
);

create table if not exists desarmaderos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text,
  contacto text,
  direccion text,
  created_at timestamptz not null default now()
);

create table if not exists registros_automotores (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  seccional text,
  direccion text,
  created_at timestamptz not null default now()
);

-- Catálogo abierto: se esperan más tipos a futuro (04D, 04C, 04 Digital, robo, etc.)
create table if not exists tipos_baja (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  created_at timestamptz not null default now()
);

-- Usuarios internos (responsables de casos). Se puede vincular a auth.users
-- más adelante agregando una FK opcional (auth_user_id uuid references auth.users).
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text unique,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- Caso (tabla central)
-- ==========================================================

create table if not exists casos (
  id uuid primary key default gen_random_uuid(),
  numero_siniestro text not null,

  aseguradora_id uuid not null references aseguradoras(id),
  asegurado_id uuid not null references asegurados(id),
  vehiculo_id uuid not null references vehiculos(id),
  desarmadero_id uuid references desarmaderos(id),
  registro_id uuid references registros_automotores(id),
  tipo_baja_id uuid references tipos_baja(id),
  responsable_id uuid references usuarios(id),

  -- Estado del flujo de negocio descripto en el CLAUDE.md
  estado text not null default 'iniciado' check (estado in (
    'iniciado',
    'informes_solicitados',
    'en_verificacion',
    'autorizacion_traslado',
    'desarmadero_asignado',
    'baja_en_tramite',
    'cerrado'
  )),

  -- Rama del caso una vez llegado el informe de dominio
  rama text check (rama in (
    'normal',
    'denuncia_robo',
    'sucesion',
    'inhibido_embargado',
    'prendado',
    'denuncia_venta',
    'baja_04c'
  )),

  tipo_tramite text check (tipo_tramite in ('fisica', 'digital')),

  fecha_ingreso date not null default current_date,
  fecha_cierre date,

  deuda_patentes numeric(12,2) default 0,
  deuda_multas numeric(12,2) default 0,

  observaciones text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_casos_estado on casos(estado);
create index if not exists idx_casos_responsable on casos(responsable_id);
create index if not exists idx_casos_aseguradora on casos(aseguradora_id);

-- ==========================================================
-- Bitácora: historial cronológico de eventos de un caso
-- ==========================================================

create table if not exists bitacora (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id) on delete cascade,
  tipo_evento text not null, -- ej: "inicia baja", "pedido de traslado"
  observacion text,
  es_interna boolean not null default false,
  completado boolean not null default false,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_bitacora_caso on bitacora(caso_id);

-- ==========================================================
-- Documentos: imágenes del dominio vs documentación para la compañía
-- ==========================================================

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id) on delete cascade,
  categoria text not null check (categoria in ('imagen_dominio', 'documento_compania')),
  nombre text not null,
  url text not null, -- ruta en Supabase Storage o URL externa
  created_at timestamptz not null default now()
);

create index if not exists idx_documentos_caso on documentos(caso_id);

-- ==========================================================
-- updated_at automático en casos
-- ==========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_casos_updated_at on casos;
create trigger trg_casos_updated_at
  before update on casos
  for each row execute function set_updated_at();

-- ==========================================================
-- RLS: por ahora sin autenticación (fase 1). Se deja habilitado
-- con políticas permisivas para no romper cuando se sume auth.
-- IMPORTANTE: ajustar estas políticas cuando se implemente
-- autenticación básica (ver estado del proyecto en CLAUDE.md).
-- ==========================================================

alter table aseguradoras enable row level security;
alter table asegurados enable row level security;
alter table vehiculos enable row level security;
alter table desarmaderos enable row level security;
alter table registros_automotores enable row level security;
alter table tipos_baja enable row level security;
alter table usuarios enable row level security;
alter table casos enable row level security;
alter table bitacora enable row level security;
alter table documentos enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'aseguradoras','asegurados','vehiculos','desarmaderos',
    'registros_automotores','tipos_baja','usuarios',
    'casos','bitacora','documentos'
  ])
  loop
    execute format(
      'drop policy if exists "allow_all_%1$s" on %1$s;
       create policy "allow_all_%1$s" on %1$s for all using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ==========================================================
-- Datos semilla mínimos para poder probar el CRUD de una
-- ==========================================================

insert into tipos_baja (nombre, descripcion) values
  ('04D', 'Baja por destrucción total'),
  ('04C', 'Baja 04C'),
  ('04 Digital', 'Baja digital'),
  ('Baja por robo', 'Baja por denuncia de robo')
on conflict (nombre) do nothing;
