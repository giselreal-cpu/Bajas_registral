-- "Pendientes de recordatorio" (Panel → Encuestas) no tenía forma de
-- distinguir una encuesta a la que nunca se le mandó recordatorio de
-- una a la que ya se le mandó uno y sigue sin responder — por eso
-- quedaban acumulando horas hábiles indefinidamente en la lista, cada
-- vez más viejas, sin nunca desaparecer. Este flag marca que ya se
-- usó el "Reenviar recordatorio" al menos una vez, para poder sacarla
-- de la lista si pasan 96hs hábiles desde ese reenvío sin respuesta
-- (ver POST /api/encuestas/[id]/recordatorio y panelData.ts).
alter table encuestas_satisfaccion
  add column if not exists recordatorio_enviado boolean not null default false;
