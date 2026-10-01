-- Nuevas categorías de documento para que el desarmadero pueda subir
-- comprobantes desde su enlace público (/d/[token]) — hasta ahora esa
-- sección solo mostraba documentos ya cargados por el equipo, sin
-- forma de que el desarmadero suba nada. Fotos del vehículo se siguen
-- cargando bajo 'imagen_dominio' (así aparecen junto a las que ya
-- carga el equipo interno); estas tres son para lo que antes no tenía
-- categoría propia. Mismo patrón que 0021/0032/0041/0057 al ampliar
-- el catálogo de categorías.
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
    'anexo04_rudac',
    'multa_desarmadero',
    'patente_desarmadero',
    'otro_desarmadero'
  )
);
