-- El get-or-create de POST /api/casos/[id]/encuesta (select existente,
-- si no hay insert) tiene una condición de carrera: dos llamadas casi
-- simultáneas (ej.: el componente EncuestaBox montándose dos veces)
-- pueden ver ambas "no existe" y crear dos filas para el mismo caso.
-- Se agrega un constraint único + se cambia el insert a upsert
-- (ver route.ts) para que sea atómico.

-- Por las dudas: si llegó a haber más de una encuesta para el mismo
-- caso, nos quedamos con la más reciente (o la ya respondida, si hay
-- una) y borramos el resto antes de crear el constraint.
delete from encuestas_satisfaccion a
using encuestas_satisfaccion b
where a.caso_id = b.caso_id
  and (
    a.respondida < b.respondida
    or (a.respondida = b.respondida and a.created_at < b.created_at)
  );

alter table encuestas_satisfaccion
  add constraint encuestas_satisfaccion_caso_id_key unique (caso_id);
