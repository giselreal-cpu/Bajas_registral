-- "Caja pesos" pasa a ser la caja por defecto para todo lo que ya está
-- efectivamente pagado (egresos) o cobrado (cobros) y no tenía una caja
-- puntual asignada — antes esos movimientos quedaban afuera del Libro
-- de movimientos y de Liquidez por no tener caja, aunque ya representen
-- plata real que entró o salió. De acá en más la app asigna esto solo
-- (ver src/lib/cajaPesos.ts); esta migración es el backfill único de lo
-- que ya estaba cargado.

update movimientos_caso
set caja_id = (select id from cajas where nombre = 'Caja pesos')
where pagado = true
  and caja_id is null;

update cobros
set caja_id = (select id from cajas where nombre = 'Caja pesos')
where caja_id is null;
