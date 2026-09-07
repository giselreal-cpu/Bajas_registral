-- =====================================================================
-- Capa contable aditiva: dos catálogos nuevos (cajas, cuentas_contables)
-- y columnas opcionales en lo que ya existe. La lógica por caso no
-- cambia: un movimiento sin caja/cuenta asignada sigue siendo válido y
-- sigue impactando la rentabilidad del caso igual que antes de esta
-- migración — los históricos quedan en NULL y siguen funcionando.
-- =====================================================================

-- =====================================================================
-- 1. Cajas: medios/cuentas de efectivo reales (caja física, cuenta
-- bancaria, billetera virtual, fondo fijo). Solo catálogo — no calcula
-- saldo desde acá, el saldo se deriva de movimientos_caso.caja_id.
-- =====================================================================

create table if not exists cajas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('efectivo', 'banco', 'billetera', 'fondo_fijo')),
  saldo_inicial numeric(12,2) not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 2. Cuentas contables: catálogo jerárquico simple (código + nombre),
-- con un flag `imputable` para distinguir cuentas de detalle (donde sí
-- se cargan movimientos) de cuentas de agrupación.
-- =====================================================================

create table if not exists cuentas_contables (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  imputable boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3. Mapeo por defecto: cada concepto de movimiento puede sugerir una
-- cuenta contable. Se propone solo, el usuario la puede corregir al
-- momento de la carga (por eso `movimientos_caso.cuenta_contable_id` es
-- independiente y no se sincroniza automáticamente con este mapeo).
-- =====================================================================

alter table conceptos_movimiento
  add column if not exists cuenta_contable_id uuid references cuentas_contables(id) on delete set null;

-- =====================================================================
-- 4. Columnas opcionales en lo existente. `caja_id`/`cuenta_contable_id`
-- nullable en movimientos_caso, `caja_id` nullable en cobros. El centro
-- de costo no suma columna nueva: se lee de casos.aseguradora_id, ya
-- existente.
-- =====================================================================

alter table movimientos_caso
  add column if not exists caja_id uuid references cajas(id) on delete set null,
  add column if not exists cuenta_contable_id uuid references cuentas_contables(id) on delete set null,
  add column if not exists documento_id uuid references documentos(id) on delete set null,
  add column if not exists aprobado boolean not null default true;

comment on column movimientos_caso.aprobado is
  'Solo relevante para gastos cargados desde la app móvil (Caja): quedan en false hasta que alguien del equipo los aprueba. Los movimientos cargados desde escritorio se insertan ya en true y no cambian de comportamiento.';

alter table cobros
  add column if not exists caja_id uuid references cajas(id) on delete set null;

create index if not exists idx_movimientos_caso_caja on movimientos_caso(caja_id);
create index if not exists idx_movimientos_caso_aprobado on movimientos_caso(aprobado) where aprobado = false;

-- =====================================================================
-- 5. Nueva categoría de documento: el comprobante de un gasto cargado
-- desde la app móvil (Caja → Registrar gasto). Mismo patrón que
-- 0021/0032 al ampliar el catálogo de categorías.
-- =====================================================================

alter table documentos drop constraint if exists documentos_categoria_check;
alter table documentos add constraint documentos_categoria_check check (
  categoria in (
    'imagen_dominio',
    'documento_compania',
    'turno_registro',
    'observaciones_gestor',
    'recibos_gestor',
    'otros_gestor',
    'formulario_baja',
    'comprobante_gasto'
  )
);

-- =====================================================================
-- 6. RLS: mismo criterio que el resto del módulo financiero
-- (0028_rentabilidad.sql) — solo operador/administrador, `compania` sin
-- ningún acceso.
-- =====================================================================

alter table cajas enable row level security;
alter table cuentas_contables enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['cajas', 'cuentas_contables'])
  loop
    execute format(
      'create policy "%1$s_select" on %1$s for select using (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
    execute format(
      'create policy "%1$s_insert" on %1$s for insert with check (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
    execute format(
      'create policy "%1$s_update" on %1$s for update using (rol_del_usuario_actual() in (''operador'',''administrador'')) with check (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
    execute format(
      'create policy "%1$s_delete" on %1$s for delete using (rol_del_usuario_actual() in (''operador'',''administrador''));',
      t
    );
  end loop;
end $$;

-- =====================================================================
-- 7. Catálogo inicial de cajas, a partir de lo que ya usa el equipo hoy
-- (mismo criterio que el seed de conceptos_movimiento en 0028).
-- =====================================================================

insert into cajas (nombre, tipo) values
  ('Caja Central', 'efectivo'),
  ('Cuenta bancaria', 'banco'),
  ('Fondo fijo gestores', 'fondo_fijo')
on conflict do nothing;
