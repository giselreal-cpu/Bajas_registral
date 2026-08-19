-- Recalcula el estado de todos los casos con el criterio ampliado: los
-- eventos "Petición de Informes" y "Contacto con el asegurado" ahora
-- empujan el estado con solo existir en la bitácora (completados o no),
-- porque representan un paso que ya arrancó. El resto de los eventos
-- clave siguen empujando el estado solo al completarse. Corrige tanto los
-- casos que quedaron atrás por este cambio de criterio como los que
-- quedaron atrás por drift (por ejemplo, el estado se tocó a mano después
-- de completar un evento y nunca se volvió a recalcular). Nunca retrocede
-- un estado que ya estuviera más avanzado.

with rangos(estado, rango) as (
  values
    ('iniciado', 0),
    ('informes_solicitados', 1),
    ('en_verificacion', 2),
    ('autorizacion_traslado', 3),
    ('desarmadero_asignado', 4),
    ('traslado_realizado', 5),
    ('baja_en_tramite', 6),
    ('presentado_en_registro', 7),
    ('documentacion_enviada', 8),
    ('cerrado', 9)
),
evento_a_estado_progreso(tipo_evento, estado) as (
  values
    ('Petición de Informes', 'informes_solicitados'),
    ('Contacto con el asegurado', 'en_verificacion')
),
evento_a_estado_completado(tipo_evento, estado) as (
  values
    ('Autorización de traslado', 'autorizacion_traslado'),
    ('Asignación de desarmadero', 'desarmadero_asignado'),
    ('Traslado', 'traslado_realizado'),
    ('Formulario de Baja', 'baja_en_tramite'),
    ('Presentación de Baja', 'presentado_en_registro'),
    ('Envío de documentación Cía', 'documentacion_enviada'),
    ('Cierre de Caso', 'cerrado')
),
rangos_alcanzados as (
  select b.caso_id, r.rango
  from bitacora b
  join evento_a_estado_progreso e on e.tipo_evento = b.tipo_evento
  join rangos r on r.estado = e.estado
  union all
  select b.caso_id, r.rango
  from bitacora b
  join evento_a_estado_completado e on e.tipo_evento = b.tipo_evento
  join rangos r on r.estado = e.estado
  where b.completado = true
),
mejor_estado_por_caso as (
  select caso_id, max(rango) as mejor_rango
  from rangos_alcanzados
  group by caso_id
)
update casos c
set
  estado = r.estado,
  fecha_cierre = case
    when r.estado = 'cerrado' and c.fecha_cierre is null then current_date
    else c.fecha_cierre
  end
from mejor_estado_por_caso m
join rangos r on r.rango = m.mejor_rango
where c.id = m.caso_id
  and r.rango > (select rango from rangos where estado = c.estado);
