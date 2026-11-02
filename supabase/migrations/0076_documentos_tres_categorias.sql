-- Los documentos del caso quedan en tres categorías: imagen_dominio,
-- documento_compania y formulario_baja. Lo que antes se archivaba como carga
-- de gestor (turno, observaciones, recibos, otros), carga del desarmadero
-- (multas, patentes, otros) o Anexo 04 pasa a "Documentación para la
-- compañía". (La pantalla ya los muestra ahí; esto deja los datos igual.)

update documentos
set categoria = 'documento_compania'
where categoria in (
  'turno_registro',
  'observaciones_gestor',
  'recibos_gestor',
  'otros_gestor',
  'multa_desarmadero',
  'patente_desarmadero',
  'otro_desarmadero',
  'anexo04_rudac'
);
