# Proyecto: Gestión de Bajas Registrales por Siniestro

## Qué es esto

Aplicación web para gestionar el proceso de baja registral de vehículos siniestrados
(pérdida total) a pedido de compañías aseguradoras. Reemplaza/organiza un flujo que
hoy se maneja de forma manual, y sirve como agenda + panel de control para el equipo
que tramita las bajas.

## Glosario de negocio (importante para no perder contexto entre sesiones)

- **Caso / Siniestro**: un trámite de baja registral de un vehículo puntual.
- **Aseguradora**: la compañía de seguros que pide la baja (cliente del servicio).
- **Asegurado / Titular**: el dueño del vehículo siniestrado.
- **Desarmadero**: empresa externa (tercero) que compra/recibe el vehículo
  siniestrado para desguace. Tiene CUIT, contacto y dirección propios.
- **Registro automotor**: oficina de registro donde se tramita la baja física.
- **Tipo de baja**: catálogo abierto (no enum fijo) — ejemplos actuales: 04D, 04C,
  04 Digital, Baja por robo. Se esperan más tipos a futuro, por eso es tabla y no
  un valor hardcodeado.
- **Bitácora**: el historial cronológico de acciones sobre un caso (observaciones,
  observaciones internas, hitos como "inicia baja", "pedido de traslado", etc.),
  con fecha de inicio, fecha de fin, quién la cargó, y si está completada.
- **Baja física vs baja digital**: dos formas de tramitar la baja, con pasos
  distintos (firma en papel + presentación física vs firma digital + carga en
  DNRPA).
- **Responsable**: por ahora, una única persona lleva el caso de punta a punta
  (no hay roles separados de gestor/tramitador todavía — se puede sumar más
  adelante sin romper el modelo, agregando más FKs a `usuarios` en `casos`).
- **Gestor de campo**: persona externa (sin cuenta en el sistema) que se
  asigna a un caso puntual (`casos.gestor_id`) para hacer trámites en el
  territorio (turno en el registro, retirar recibos, etc.). Recibe un enlace
  público permanente (`/g/<token_gestor>`) con un resumen acotado del caso y
  puede cargar archivos (fotos/PDF) en 4 categorías fijas — Turno en
  Registro, Observaciones, Recibos, Otros — sin necesitar login. Es distinto
  del "responsable" interno: no reemplaza roles del equipo, es acceso
  externo de solo-carga.

## Proceso de negocio (resumen del flujo real)

1. Ingresa un mail de la aseguradora pidiendo la baja → se asigna responsable.
2. Se carga el caso en sistema y se piden informes del dominio.
3. Se contacta al asegurado, se verifican deudas de patentes/multas.
4. Según el informe, el caso toma una de varias ramas (normal, denuncia de robo,
   sucesión, inhibido/embargado, prendado, denuncia de venta, baja 04C) — cada
   una con sus propios sub-pasos, hasta converger en "autorización de traslado".
5. Se verifica tenencia definitiva y monto de multas, se asigna un desarmadero.
6. Se tramita la baja (física o digital).
7. Se cierra con presentación en el registro y envío de documentación original
   a la compañía y al desarmadero.

## Modelo de datos

Tablas: `aseguradoras`, `asegurados`, `vehiculos`, `desarmaderos`,
`registros_automotores`, `tipos_baja`, `usuarios`, `casos`, `bitacora`,
`documentos`.

- `casos` es la tabla central: referencia a aseguradora, asegurado, vehículo,
  desarmadero, registro, tipo_baja y responsable (usuario). Guarda estado,
  número de siniestro, fechas clave, y deudas de patente/multa.
- `bitacora` guarda cada evento del caso (tipo_evento, fecha_inicio, fecha_fin,
  observación, si es interna, si está completado, quién lo cargó).
- `documentos` distingue categoría: imágenes del dominio vs documentos para
  la compañía.

## Fuera del alcance del MVP (fase 2)

- Módulo financiero: valores InfoAuto, cobros/pagos a desarmadero, gestoría,
  compañía, comisiones. Es un módulo grande, se aborda una vez que el flujo de
  casos esté sólido.
- Notificaciones automáticas.
- Roles internos separados (gestor/tramitador) — el modelo ya está preparado
  para sumarlos sin romper nada.

## Stack técnico

- Next.js (App Router) + TypeScript
- Postgres vía Supabase
- Despliegue: Vercel

## Convenciones de código

(completar a medida que se defina el proyecto: estructura de carpetas, estilo
de componentes, manejo de formularios, etc.)

## Estado actual del proyecto

> Nota: este checklist quedó como referencia del arranque del proyecto. El
> estado real y detallado de cada funcionalidad (con qué migración de Supabase
> corresponde a cada una) está documentado en `README.md`, que es el que hay
> que mantener actualizado de acá en adelante.

- [x] Setup inicial del proyecto
- [x] Modelo de datos (tablas de arriba)
- [x] Autenticación básica
- [x] CRUD de casos
- [x] Vista de detalle de caso (cabecera + bitácora + documentos)
- [x] Agenda / vencimientos
- [x] Panel de control (casos por estado, próximos vencimientos)

Funcionalidades agregadas más allá del MVP original (ver `README.md` para el
detalle completo de cada una): CRUD de catálogos, roles de usuario
(operador/administrador/compañía), historial de cambios por caso, número de
caso correlativo, generación de la Autorización de Retiro y Traslado en
.docx, exportación de datos, y sincronización automática del estado del
caso según los eventos completados en la bitácora.
