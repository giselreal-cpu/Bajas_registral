-- Repara casos que quedaron "cerrados" sin fecha_cierre cargada (bug en
-- recalcularEstado: si el estado ya estaba en "cerrado" por una vía que
-- no dejó la fecha, nunca se reintentaba completarla porque el estado
-- ya no "avanzaba" — ver src/lib/estadoAutomatico.ts). Se completa con
-- la fecha_fin real del evento "Cierre de Caso" de la bitácora de cada
-- caso y, si por algún motivo no existe ese evento, con la fecha de hoy
-- como último recurso.

update casos c
set fecha_cierre = coalesce(
  (
    select b.fecha_fin
    from bitacora b
    where b.caso_id = c.id
      and b.tipo_evento = 'Cierre de Caso'
      and b.completado = true
      and b.fecha_fin is not null
    order by b.fecha_fin desc
    limit 1
  ),
  current_date
)
where c.estado = 'cerrado'
  and c.fecha_cierre is null;
