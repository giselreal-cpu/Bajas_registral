-- Anexo 04 (Piezas RUDAC): formulario que declara, por caso, qué piezas
-- del vehículo se autoriza a desarmar (SI/NO), para dibujar las X sobre
-- el PDF oficial escaneado. El catálogo de las 143 piezas (código,
-- descripción, categoría APC/C, si requiere perito, y su posición en el
-- PDF) NO va en la base: es estático y vive en el código
-- (src/lib/piezasRudac.json) — no cambia salvo que el Ministerio
-- reedite el formulario.
--
-- NOTA: la migración sugerida traía `caso_piezas_rudac.caso_id` como
-- `bigint references casos(id)`, pero en este esquema `casos.id` es
-- `uuid` (ver 0001_init.sql) — se corrige acá. Los ids de ambas tablas
-- nuevas también se pasan a `uuid` para seguir la misma convención que
-- el resto de las tablas del proyecto.

-- 1) Tipo de vehículo del caso: es la clave para resolver las reglas.
alter table vehiculos add column if not exists tipo_vehiculo text
  check (tipo_vehiculo in ('Auto/Sedán', 'Pickup', 'SUV/Furgón', 'Camión'));

-- 2) Reglas generales por tipo de vehiculo (se cargan una sola vez desde
--    una pantalla de configuración admin-only y se reusan en todos los
--    casos futuros; equivalente a la hoja "Reglas" del Excel).
create table if not exists reglas_piezas_rudac (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,                 -- codigo de la pieza (ej "310")
  tipo_vehiculo text not null check (tipo_vehiculo in ('Auto/Sedán', 'Pickup', 'SUV/Furgón', 'Camión')),
  decision text not null check (decision in ('SI', 'NO', 'DEPENDE')),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references usuarios(id),
  unique (codigo, tipo_vehiculo)
);

-- 3) Decision final por caso (lo que efectivamente se estampa en el PDF).
--    Se completa automaticamente desde reglas_piezas_rudac al elegir el
--    tipo de vehiculo del caso, y queda editable para excepciones puntuales.
--    decision = null -> pendiente de revisar (regla "DEPENDE" o sin regla).
create table if not exists caso_piezas_rudac (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id) on delete cascade,
  codigo text not null,
  decision text check (decision in ('SI', 'NO')),
  nota text,
  unique (caso_id, codigo)
);

-- 4) Nueva categoría de documento para el Anexo 04 generado. Mismo
--    patrón que 0021/0032/0041 al ampliar el catálogo de categorías.
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
    'comprobante_gasto',
    'anexo04_rudac'
  )
);

-- 5) RLS: solo operador/administrador. `compania` no tiene ningún acceso
--    a estas tablas (mismo criterio que movimientos_caso/facturas/cobros
--    en 0028_rentabilidad.sql — es información operativa interna).
alter table reglas_piezas_rudac enable row level security;
alter table caso_piezas_rudac enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['reglas_piezas_rudac', 'caso_piezas_rudac'])
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
