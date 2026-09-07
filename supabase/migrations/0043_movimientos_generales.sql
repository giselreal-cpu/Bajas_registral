-- =====================================================================
-- Movimientos generales: ingresos/egresos que NO son de un caso puntual
-- (sueldos, hosting/plataforma, alquiler, gastos bancarios, etc.). Los
-- movimientos de caso siguen viviendo en movimientos_caso, atados a un
-- caso_id — esta es una tabla separada porque ese requisito (caso_id
-- obligatorio) es justo lo que impide cargar un gasto administrativo
-- ahí. Comparte los mismos catálogos (cajas, cuentas_contables) que el
-- resto del módulo, para que el "Libro de movimientos" y "Liquidez" de
-- /administracion puedan sumar ambas fuentes en un solo reporte.
-- =====================================================================

create table if not exists movimientos_generales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  descripcion text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto numeric(12,2) not null check (monto > 0),
  caja_id uuid references cajas(id) on delete set null,
  cuenta_contable_id uuid references cuentas_contables(id) on delete set null,
  creado_por uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_generales_fecha on movimientos_generales(fecha);
create index if not exists idx_movimientos_generales_caja on movimientos_generales(caja_id);

alter table movimientos_generales enable row level security;

-- Mismo criterio que el resto del módulo financiero (0028/0041):
-- operador/administrador leen y escriben, compania sin ningún acceso.
create policy "movimientos_generales_select" on movimientos_generales for select
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "movimientos_generales_insert" on movimientos_generales for insert
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "movimientos_generales_update" on movimientos_generales for update
  using (rol_del_usuario_actual() in ('operador', 'administrador'))
  with check (rol_del_usuario_actual() in ('operador', 'administrador'));
create policy "movimientos_generales_delete" on movimientos_generales for delete
  using (rol_del_usuario_actual() in ('operador', 'administrador'));
