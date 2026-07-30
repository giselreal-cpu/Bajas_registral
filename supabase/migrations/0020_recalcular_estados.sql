-- El avance automático de estado solo se dispara al completar un evento
-- DESDE que esa lógica existe. Cualquier caso que ya tuviera un evento
-- clave completado de antes (por ejemplo, en pruebas previas, o por un
-- problema puntual) se quedó con un estado atrasado. Esta migración
-- recalcula el estado de TODOS los casos según sus eventos de bitácora
-- ya completados, sin retroceder nunca un estado que ya estuviera más
-- avanzado.

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
evento_a_estado(tipo_evento, estado) as (
  values
    ('Petición de Informes', 'informes_solicitados'),
    ('Contacto con el asegurado', 'en_verificacion'),
    ('Autorización de traslado', 'autorizacion_traslado'),
    ('Asignación de desarmadero', 'desarmadero_asignado'),
    ('Traslado', 'traslado_realizado'),
    ('Formulario de Baja', 'baja_en_tramite'),
    ('Presentación de Baja', 'presentado_en_registro'),
    ('Envío de documentación Cía', 'documentacion_enviada'),
    ('Cierre de Caso', 'cerrado')
),
mejor_estado_por_caso as (
  select b.caso_id, max(r.rango) as mejor_rango
  from bitacora b
  join evento_a_estado e on e.tipo_evento = b.tipo_evento
  join rangos r on r.estado = e.estado
  where b.completado = true
  group by b.caso_id
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
