# Bajas Registrales por Siniestro

MVP en Next.js (App Router) + TypeScript + Supabase (Postgres + Auth),
siguiendo el `CLAUDE.md` del proyecto.

## Qué incluye este MVP

- **Modelo de datos completo** (`supabase/migrations/0001_init.sql`):
  `aseguradoras`, `asegurados`, `vehiculos`, `desarmaderos`,
  `registros_automotores`, `tipos_baja`, `usuarios`, `casos`, `bitacora`,
  `documentos`.
- **CRUD de casos**:
  - Listado con filtro por número de siniestro, **dominio** y
    **compañía/aseguradora**, además del filtro por estado (`/casos`), con
    marca y modelo del vehículo debajo del dominio en cada fila.
  - Alta de caso, creando en el mismo paso el asegurado y el vehículo
    (`/casos/nuevo`).
  - Vista de detalle (`/casos/[id]`) con cabecera organizada en secciones
    con título propio (Datos del caso, Trámite, Vehículo, Datos
    económicos, Asegurado / titular), todas editables:
    número de siniestro, número de póliza, **aseguradora**, nombre y
    contacto del productor, nombre y email del trámitador de la compañía,
    dominio/marca/modelo/año del vehículo, suma asegurada, estado, rama,
    tipo de trámite, tipo de baja, responsable, registro, deudas, fechas,
    y los datos propios del asegurado. El campo **desarmadero** de la cabecera es de solo lectura
    desde `0036_desarmadero_en_evento.sql` — se asigna desde el propio
    evento de bitácora "Asignación de desarmadero" (ver "Bitácora" más
    abajo), no desde acá. Editar el vehículo o los datos del asegurado
    actualiza `vehiculos`/`asegurados` por separado
    (`/api/vehiculos/[id]`, `/api/asegurados/[id]`). El campo de
    Observaciones se sacó de esta vista (el dato sigue existiendo en la
    base por si se usa en otro lado, simplemente ya no se muestra acá).
- **CRUD de catálogos** (`/catalogos`): aseguradoras, desarmaderos, registros
  automotores, tipos de baja y usuarios, cada uno con alta, edición inline y
  borrado.
- **Agenda de vencimientos** (`/agenda`): eventos de bitácora pendientes de
  todos los casos abiertos, agrupados en Vencidos / Próximos 7 días / Más
  adelante / Sin fecha, con filtro por responsable.
- **Panel de control** (`/panel`, página de inicio): filtro por
  **compañía/aseguradora, mes de ingreso y tipo de baja** (afecta todo el
  panel — por ejemplo, para ver cuánto tarda en promedio un 04C
  específicamente. No hay filtro por estado ahí porque "Casos por estado"
  ya desglosa por estado — sería redundante. El resto del panel
  —vencimientos, casos sin movimiento— sigue mostrando todo, ya que son
  alertas operativas, no un reporte). Toda la obtención de datos vive en
  un módulo compartido (`src/lib/panelData.ts` → `obtenerDatosPanel`),
  para que el Panel y `/panel/detalle` (ver más abajo) usen exactamente
  el mismo recorte de casos según los filtros aplicados. Muestra: casos
  totales/abiertos/cerrados, casos por estado, alerta de **casos sin
  movimiento hace 7+ días** (configurable en `DIAS_SIN_MOVIMIENTO` en
  `src/lib/panelData.ts`, solo aparece si hay algún caso en esa
  situación), alerta de **casos sin contactar al asegurado** (casos
  abiertos que todavía no tienen ningún evento "Contacto con el
  asegurado" cargado, ni pendiente ni completado), una lista combinada
  de **"Próximos vencimientos"** que junta los eventos de bitácora con
  fecha de vencimiento cargada *y* los casos sin movimiento hace 7+ días
  (los vencidos aparecen primero), la tarjeta de Rentabilidad (ver
  módulo financiero más abajo), y resúmenes compactos —con un link
  **"Ver detalle →"**— de: "Casos por gestor" (total/pendientes/cerrados
  sin pagar por gestor), "Eventos sin completar" (cuántos casos tienen
  cada tipo de evento cargado pero no completado), "Encuestas de
  satisfacción" (enviadas/respondidas/sin responder + promedio por
  pregunta) y "Tiempos de trámite" (promedio de días de trámite completo
  y de presentación→cierre, oculto para el rol compañía). Los listados
  completos de esas cuatro secciones —el desplegable por gestor, el
  `<details>` con los casos de cada tipo de evento, los comentarios
  destacados y pendientes de recordatorio de encuestas, y la tabla de
  casos cerrados con sus tiempos— viven aparte en **`/panel/detalle`**
  (con anclas `#gestores`/`#eventos`/`#encuestas`/`#tiempos`, y los
  mismos filtros de compañía/mes/tipo de baja del Panel propagados por
  query string), para que el Panel en sí quede como un resumen liviano
  y no una página larga con todos los listados desplegados.
- **Avance automático de estado**: el catálogo de estados del caso tiene un
  paso propio por cada evento clave de la bitácora (`0010_estados_por_evento.sql`),
  así el seguimiento es más preciso. Cada vez que se agrega o edita un
  evento de bitácora, el `estado` del caso se **recalcula completo** desde
  todos sus eventos (`src/lib/estadoAutomatico.ts` → `recalcularEstado`,
  usado en las rutas de bitácora) — no solo mirando el evento que se acaba
  de tocar, así no importa el orden en que se carguen ni si alguno se
  completó "fuera de la app" (import de datos viejos, ajuste manual, etc.).
  Dos tipos de eventos empujan el estado con **solo existir** (completados
  o no), porque representan un paso que ya arrancó y del que se está
  esperando algo:
  - "Petición de Informes" → Informes solicitados (ya los pedimos, se está
    esperando la respuesta)
  - "Contacto con el asegurado" → En verificación (ya se lo está
    contactando/verificando)

  El resto de los eventos clave solo empujan el estado al **completarse**
  (representan un hito ya conseguido, no algo en curso):
  - "Autorización de traslado" → Autorización de traslado
  - "Asignación de desarmadero" → Desarmadero asignado
  - "Traslado" → Traslado realizado
  - "Formulario de Baja" → Formulario de baja presentado
  - "Presentación de Baja" → Presentado en el registro
  - "Envío de documentación Cía" → Documentación enviada a la Cía
  - "Cierre de Caso" → Cerrado (completa `fecha_cierre` con la fecha de hoy
    si todavía no tenía una)

  "Ingreso de caso", "Baja de Patentes" y "Observaciones" no mueven el
  estado. **Solo "Cierre de Caso" puede llevar el caso a "Cerrado"** —
  hasta agosto de 2026 completar "Baja de Patentes" también lo cerraba
  directamente (sin pasar por el gating de prerequisitos de "Cierre de
  Caso"), lo que llegó a dejar un caso marcado como cerrado con
  "Presentación de Baja" todavía pendiente; se sacó ese atajo. Solo
  avanza hacia adelante — nunca retrocede el estado
  automáticamente, ni siquiera si se destilda un evento o se lo borra. El
  estado se puede seguir cambiando a mano en cualquier momento desde la
  cabecera del caso, esto es un adicional, no un reemplazo (aunque un
  cambio a mano hacia atrás puede quedar "atrasado" hasta el próximo
  evento de bitácora que se toque, que va a recalcularlo hacia adelante de
  nuevo).
  **Importante**: si hace falta ponerse al día por eventos que ya estaban
  cargados de antes (por ejemplo, después de una migración de datos vieja,
  o si el estado quedó desincronizado por un cambio manual), correr
  `0022_recalcular_estados_v2.sql`, que recalcula el estado de todos los
  casos con este mismo criterio, sin retroceder nunca uno que ya estuviera
  más avanzado.
  Además, el prerequisito de cada evento (que ya se validaba en el
  navegador) también se valida **en el servidor**
  (`src/lib/eventosBitacora.ts` → `motivoBloqueo`, usado en las rutas de
  bitácora), para que no se pueda saltear llamando a la API directo.
- **Bitácora**:
  - Un tipo de evento no se puede cargar dos veces para el mismo caso —
    esté completado o pendiente (el desplegable ya no lo ofrece una vez
    cargado, y el servidor lo bloquea igual si se intenta por otra vía) —
    salvo **"Observaciones"**, que no tiene prelación ni conexión con nada
    y se puede repetir todas las veces que haga falta.
  - Cada evento tiene un botón **"Eliminar"** (antes solo se podía editar
    o marcar completado/pendiente).
  - Tipo de evento por lista desplegable, con un catálogo **cerrado** de 12
    tipos (`src/lib/eventosBitacora.ts`): Ingreso de caso, Petición de
    Informes, Contacto con el asegurado, Autorización de traslado,
    Asignación de desarmadero, Traslado, Formulario de Baja, Presentación
    de Baja, Envío de documentación Cía, Cierre de Caso, Baja de Patentes
    (sin prerequisito ni estado asociado, para registrar ese trámite sin
    que bloquee ni mueva nada más) y Observaciones (sin prerequisito, para
    anotaciones sueltas que no encajan en los otros).
  - Cada tipo tiene su propio prerequisito puntual (`TIPOS_EVENTO` en
    `src/lib/eventosBitacora.ts` → `motivoBloqueo`): "Autorización de
    traslado" requiere "Contacto con el asegurado" completado; "Asignación
    de desarmadero" requiere "Autorización de traslado" completado;
    "Traslado" requiere "Petición de Informes" completado; "Presentación
    de Baja" y "Envío de documentación Cía" requieren "Asignación de
    desarmadero" completado; "Cierre de Caso" requiere que estén TODOS
    completados: Petición de Informes, Autorización de traslado, Traslado,
    Formulario de Baja, Presentación de Baja y Envío de documentación Cía.
    No se puede marcar un evento como completado si su prerequisito no lo
    está. **"Formulario de Baja" no tiene prerequisito duro** (en la
    práctica el 04D a veces se completa antes de que la unidad termine de
    trasladarse) — si se completa sin que "Traslado" esté completado
    todavía, se muestra un aviso no bloqueante en vez de impedirlo; el
    bloqueo real sigue estando en "Cierre de Caso", que sí exige
    "Traslado" completado.
  - Los eventos ya cargados se pueden **editar** (tipo, observación,
    fechas, interna/completada) con el botón "Editar".
  - Las observaciones marcadas como **interna** solo se muestran a quien
    esté logueado como el responsable del caso — ver sección de
    Autenticación abajo, es real (server-side), no un adorno visual.
  - Al elegir (o editar) el tipo de evento **"Contacto con el asegurado"**
    aparece un mensaje sugerido, con los datos del caso ya completados, para
    mandarle al asegurado por WhatsApp **antes** de llamarlo (así la llamada
    no le resulte sorpresiva/sospechosa). Hay un botón **"Copiar mensaje"**
    (queda en el portapapeles, para pegarlo donde haga falta) y uno **"Abrir
    WhatsApp"** que arma un link `wa.me` con el teléfono del asegurado y el
    mensaje precargado — no envía nada automáticamente, solo abre WhatsApp
    con el chat y el texto listos para que la persona responsable revise y
    mande. El formato del teléfono para `wa.me` es un mejor esfuerzo (no
    siempre acierta el prefijo de celulares argentinos), por eso "Copiar
    mensaje" queda como respaldo. Ver `src/components/casos/BitacoraSection.tsx`.
  - Mismo patrón de nombre + contacto + mensaje de WhatsApp para el evento
    **"Traslado"** (datos del gruero asignado) y para **"Formulario de
    Baja"** (persona que va a completar y cargar el 04D). En ambos casos,
    una vez guardado el evento aparece además un **enlace público
    permanente** sin necesidad de cuenta: `/gr/<token>` para el gruero (solo
    lectura — ve un resumen de la unidad y puede descargar la autorización
    de retiro y el informe de dominio ya cargados) y `/fb/<token>` para
    quien complete el Formulario de Baja (puede además **subir** el
    documento completado, que queda guardado en Documentos con categoría
    `formulario_baja`). Si se cambia el nombre asignado, el token se
    regenera solo y el enlace anterior deja de servir. El middleware
    (`src/lib/supabase/middleware.ts`) exime a `/g/*`, `/gr/*`, `/fb/*`,
    `/gestor/*` y `/encuesta/*` de requerir sesión (junto con las rutas
    de manifest dinámico por token, ver "Gestor de campo" más abajo).
  - El evento **"Asignación de desarmadero"** tiene su propio selector de
    desarmadero (catálogo `/catalogos/desarmaderos`); al guardarlo se
    replica en `casos.desarmadero_id` desde el servidor, así la cabecera
    del caso queda al día sin tener que tocarla a mano.
  - **Notificaciones por mail**: al completar "Ingreso de caso", "Contacto
    con el asegurado", "Traslado" o "Presentación de Baja" (por el form de
    alta, por edición, o por el toggle rápido de "Completada"), al asignar
    un gestor de campo nuevo, o al crear un caso, aparece un selector para
    avisarle por mail a Tramitador/Productor/Asegurado — se elige a quién
    cada vez, no es una configuración fija, y un destinatario solo se
    puede tildar si tiene mail cargado (`tramitador_email`,
    `productor_contacto` tal cual, o `asegurado.email`). El formulario de
    alta de caso (`/casos/nuevo`) tiene sus propios campos de
    Tramitador/Productor (nombre + mail/contacto) para poder cargarlos
    desde el vamos, justamente para que este selector tenga con qué
    trabajar apenas se crea el caso. El envío es *best-effort*: si falla,
    no revierte ni bloquea la acción principal, solo se muestra el error.
    Se envía con **Gmail** (`nodemailer`, `GMAIL_USER`/`GMAIL_APP_PASSWORD`
    en `.env.local` — hace falta una contraseña de aplicación de Gmail, no
    la contraseña normal de la cuenta). El texto del mail de "Contacto con
    el asegurado" incluye el estado de **deuda de multas y de patentes**
    del caso (`formatMoneda`, en `src/lib/email/notificacionesCaso.ts`).
    Ver también `src/lib/email/enviarEmail.ts`,
    `src/components/casos/SelectorNotificacion.tsx` y
    `/api/casos/[id]/notificar`.
  - **Encuesta de satisfacción**: al completar "Presentación de Baja"
    aparece, junto al selector de notificación por mail, una caja con un
    mensaje de WhatsApp sugerido (3 preguntas puntuales — información
    recibida en el primer contacto, atención durante el traslado,
    acompañamiento de la gestoría — cada una calificable de 1 a 5, más un
    comentario opcional) y un enlace público de una sola respuesta
    (`/encuesta/<token>`, sin necesidad de cuenta). El alta de la encuesta
    es get-or-create (`POST /api/casos/[id]/encuesta`, upsert atómico
    sobre un constraint único de `caso_id` — ver `0038`) para no duplicar
    filas si la caja se llega a montar más de una vez. Una vez respondida,
    el resultado se ve en la propia bitácora del caso, y el Panel suma un
    resumen "Encuestas de satisfacción" (enviadas/respondidas/sin
    responder, promedio de calificación por pregunta) con su detalle
    completo en `/panel/detalle`: comentarios destacados, todas las
    enviadas, y una lista de "Pendientes de recordatorio" (más de 48hs
    hábiles sin responder, calculado con
    `src/lib/fechas.ts` → `horasHabilesTranscurridas`) con un botón
    **"Reenviar recordatorio"** (`src/components/panel/RecordatorioEncuesta.tsx`
    → `POST /api/encuestas/[id]/recordatorio`) que reinicia ese conteo y
    vuelve a mostrar la caja de WhatsApp. Igual que el resto de los
    enlaces públicos, no envía nada automáticamente — solo arma el
    mensaje y el enlace para que la persona responsable lo mande a mano.
    Ver `src/lib/whatsapp.ts` (mensaje + armado del link `wa.me`,
    compartido con el resto de las cajas de WhatsApp de la bitácora) y
    `src/app/encuesta/[token]/`.
  - **Generación retroactiva**: la caja de WhatsApp normalmente aparece
    sola al completar "Presentación de Baja", pero un caso puede haber
    llegado a ese estado (o incluso estar ya cerrado) desde antes de que
    existiera esta función, sin encuesta generada. Por eso ese evento de
    la bitácora tiene además un botón manual **"Generar encuesta"** (o
    "Ver enlace de encuesta" si ya existe), que muestra la misma caja en
    cualquier momento — no hace falta reeditar el evento. El alta sigue
    siendo get-or-create, así que no duplica la fila si ya había una.
- **Exportar datos** (`/exportar`): CSV de casos (incluye el nombre del
  **trámitador de la compañía**), bitácora y documentos (con relaciones ya
  resueltas, listo para Excel) más un backup completo en JSON de todas las
  tablas.
- **Documentos**: al agregar uno, se elige **"Pegar un link"** (por ejemplo
  una carpeta de Drive — sigue siendo el uso habitual del equipo interno) o
  **"Subir un archivo"** (fotos JPG/PNG/WEBP/HEIC o PDF, hasta 10MB) a un
  bucket privado de Supabase Storage (`documentos-casos`, creado en
  `0021_modulo_gestor.sql`). Para verlos/descargarlos se generan URLs
  firmadas al vuelo cuando el documento es un archivo real (1 hora de
  validez, `src/lib/documentosStorage.ts` → `obtenerUrlFirmada`); si es un
  link externo se usa tal cual, sin intentar firmarlo. Al borrar un
  documento que era archivo real también se borra del bucket. Se pueden
  arrastrar entre "Imagen del dominio" y "Documento para la compañía" para
  corregir la categoría sin borrar y volver a cargar, y también se pueden
  eliminar.
  - **Subida directa a Storage (no pasa por Vercel)**: Vercel limita a
    **4.5MB** el body de cualquier función serverless (Server Action o
    Route Handler), un límite de la plataforma que no se puede subir por
    configuración — así que el archivo nunca viaja por una función de
    Vercel. En su lugar, el servidor solo genera una **URL de subida
    firmada** de Supabase Storage (`src/lib/documentosStorage.ts` →
    `crearSubidaFirmada`, `POST /api/casos/[id]/documentos/subida-firmada`
    para la carga interna) y el navegador sube el archivo **directo** a
    Storage con esa URL (`src/lib/uploadArchivoDirecto.ts` →
    `subirArchivoDirecto`); recién después se registra el documento en la
    base con un segundo paso liviano (`POST /api/casos/[id]/documentos`,
    ahora JSON: `{categoria, nombre, path}` o `{categoria, nombre, url}`
    para un link). Este mismo patrón de dos pasos se usa en las tres
    pantallas donde se sube un archivo: la carga interna
    (`DocumentosSection.tsx`), el enlace del gestor (`/g/[token]`) y el
    del Formulario de Baja (`/fb/[token]`). `/api/documentos/[id]`
    (PUT/DELETE) no cambió.
- **Gestor de campo**: catálogo nuevo (`/catalogos/gestores`, nombre +
  contacto + **dirección, email y zona de cobertura**) para personas
  externas que hacen trámites en el territorio (turno en el registro,
  retirar recibos, etc.). Se asignan a un caso desde su cabecera (campo
  "Gestor asignado"), lo que genera un **enlace público permanente**
  (`/g/<token>`) sin necesidad de cuenta ni login: el gestor ve un
  resumen acotado del caso (aseguradora, **tipo de baja**, vehículo,
  datos de contacto del asegurado, registro de radicación, y los
  documentos ya adjuntados) y puede subir archivos en 4 categorías fijas —
  Turno en Registro, Observaciones, Recibos, Otros — que quedan visibles
  para el equipo en la sección "Cargado por el gestor" de Documentos.
  También puede cargar una **observación libre**, que queda como un
  evento de bitácora "Observaciones" más (completado, sin `creado_por`
  porque el gestor no tiene cuenta — el autor va identificado dentro del
  propio texto: `Autor: Gestor (nombre)`). Ver
  `src/app/g/[token]/ObservacionForm.tsx` y `actions.ts` →
  `agregarObservacionGestor`. Desde la cabecera del caso hay un
  botón **"Copiar mensaje"** que arma un texto con los datos del asegurado,
  el registro y el enlace, para pegarlo donde se le quiera avisar al gestor
  (no se envía nada automáticamente), y **"Regenerar enlace"** para invalidar
  el enlace vigente si se comparte por error. Al reasignar el caso a otro
  gestor, el enlace anterior se regenera solo. El middleware
  (`src/lib/supabase/middleware.ts`) exime a `/g/*` de requerir sesión (junto
  con `/gr/*`, `/fb/*` y `/encuesta/*` — ver "Bitácora" más abajo).
  - **Historial de asignaciones por gestor** (`/gestor/<token_acceso>`):
    a diferencia del `token_gestor`, que es por *caso*, cada gestor tiene
    además un `token_acceso` propio y permanente (`gestores.token_acceso`,
    `0040_gestores_token_acceso.sql`) que identifica a la *persona*. Esa
    página lista, desde la base (no desde lo que ese celular haya
    visitado), todos los casos donde el gestor está o estuvo asignado
    —abiertos y cerrados, más reciente primero, con estado— y cada uno
    linkea a su `/g/<token_gestor>`. Desde cualquier caso hay un link
    **"Ver todas mis asignaciones →"** hacia ese hub. Pensado para que,
    si el gestor instala el ícono de la app en su celular (ver PWA más
    abajo), lo que se le abra sea el listado completo y no un caso
    puntual perdido entre varios.
  - **Instalación como app (PWA) desde los enlaces públicos**: `/g/*` y
    `/fb/*` muestran un banner para "Agregar a la pantalla de inicio"
    (`InstallBanner.tsx`). El manifest general de la app tiene
    `start_url: "/"`, que exige sesión — inservible para alguien sin
    cuenta. Por eso estas páginas sirven su propio manifest dinámico por
    token (`src/lib/pwaManifest.ts` → `manifestParaRuta`,
    `/api/manifest-gestor-hub/[token]` y
    `/api/manifest-formulario-baja/[token]`, exceptuados de sesión en el
    middleware junto con las páginas de arriba): el de `/fb/[token]`
    vuelve a ese mismo formulario, y el de `/g/[token]` **no** apunta al
    caso puntual sino al hub del gestor (`/gestor/<token_acceso>`,
    resuelto en el propio `generateMetadata` de la página) — así, sin
    importar desde qué caso instale el ícono, siempre vuelve al listado
    completo de asignaciones.
- **Catálogo de registros automotores precargado**: 835 registros
  seccionales de competencia AUTOMOTOR de todo el país (DNRPA), con
  número, denominación y provincia, cargados vía
  `0011_registros_dnrpa.sql` (simplificado luego en `0012_simplificar_registros.sql`
  a solo esos tres datos). El desplegable de "Registro automotor" en la
  cabecera del caso los agrupa por provincia (`<optgroup>`) y muestra
  número + denominación. Se pueden seguir agregando/editando/borrando
  desde `/catalogos/registros-automotores` como cualquier otro catálogo.
  Quedaron afuera, a propósito, los registros de motovehículos y
  maquinaria agrícola.
- **Historial de cambios** (nueva sección al final del detalle del caso,
  oculta para el rol compañía): registra quién hizo cada cambio, qué tipo
  de cambio fue, y cuándo — creación del caso, edición de datos del caso/
  vehículo/asegurado, alta/edición/completado/borrado de eventos de
  bitácora, y alta/edición/borrado de documentos. Se completa solo desde
  el backend (`src/lib/historial.ts`), no se puede editar ni borrar a
  mano — es un registro de auditoría. Tabla nueva `historial_cambios`
  (`0015_historial_cambios.sql`).
- **Número de caso correlativo**: cada caso tiene un `numero_caso`
  autonumerado (1, 2, 3...), independiente del número de siniestro, para
  poder enumerarlos sin tener que prefijarlo a mano. Se ve como primera
  columna en `/casos` y como "N° X" en el encabezado del detalle del caso.
  Los casos que ya existían se renumeraron por orden de fecha de ingreso.
  Al borrar un caso, su número **no se reutiliza ni se renumeran los
  demás** (a propósito, para no cambiar la numeración de casos que ya
  quedaron referenciados puertas afuera). Los casos de demo/prueba quedan
  con `numero_caso = 0` y se muestran con una etiqueta "DEMO" en vez de un
  número, para no ocupar lugar en la numeración real
  (`0016_numero_caso_demo.sql`). Si se cambia la aseguradora de un caso
  hacia o desde "Aseguradora Demo S.A.", el `numero_caso` se ajusta solo
  (pasa a 0, o toma el próximo número real disponible), usando la función
  `siguiente_numero_caso()` (`0018_siguiente_numero_caso.sql`).
  **Importante**: si en algún momento hace falta ajustar `numero_caso` a
  mano por SQL, siempre correr después
  `select setval(pg_get_serial_sequence('casos','numero_caso'), (select coalesce(max(numero_caso),0) from casos));`
  para resincronizar la secuencia — si no, el próximo caso nuevo puede
  terminar repitiendo un número ya usado (fue justamente lo que pasó y
  arregla `0019_fix_duplicado_numero_caso.sql`).
- **Autorización de retiro y traslado** (dos botones en el detalle del
  caso — .docx y PDF): genera una carta descargable con la autorización
  de retiro (declaraciones legales de embargo/inhibición, multas/deudas
  siempre a cargo del titular, y estado de entrega del vehículo).
  Requirió agregar campos nuevos: `numero_poliza` en casos,
  `entre_calles`/`partido` en asegurados. La sección "quien hará entrega
  del vehículo" queda siempre **en blanco**, para completar a mano al
  momento de la entrega — el campo "Ítem" y la función de "tercero
  autorizado a entregar la unidad" que existían antes se sacaron de la
  cabecera del caso y del documento, a pedido del usuario, para que el
  formato coincida con el que usa la aseguradora.
  - **Encabezado con logos**: el logo de la aseguradora (cargado por
    aseguradora en `/catalogos/aseguradoras`, tabla `aseguradoras`,
    columna `logo_path`, bucket privado de Storage
    `logos-aseguradoras`) y el de Oltra (fijo, `public/logo-oltra.jpg`)
    van lado a lado arriba de todo. Si la aseguradora todavía no tiene
    logo cargado, el documento se genera igual, solo con el de Oltra.
  - **Dos generadores en paralelo, mismos datos de entrada**
    (`DatosAutorizacion`): `src/lib/documentos/autorizacionRetiro.ts`
    arma el `.docx` con `docx` (npm); `src/lib/documentos/autorizacionRetiroPdf.ts`
    arma el PDF con `pdf-lib`, con su propio motor de wrap/paginación de
    texto a mano (pdf-lib no trae uno). Son dos implementaciones
    separadas — **no** una conversión docx→PDF — porque Vercel
    (serverless) no tiene LibreOffice/soffice disponible para hacer esa
    conversión en runtime.
- **Autenticación básica** (Supabase Auth): login con email/contraseña, y
  opcionalmente con **Google** (botón "Continuar con Google" en `/login`,
  requiere configuración externa — ver sección "Login con Google" más
  abajo). Todas las rutas y toda la API requieren sesión iniciada.
- **Roles de usuario** (`operador`, `administrador`, `compania`), asignables
  desde `/catalogos/usuarios`:
  - **Operador**: acceso normal de siempre (crear/editar casos, catálogos,
    bitácora, documentos). No ve observaciones internas salvo que sea el
    responsable del caso puntual.
  - **Administrador**: igual que operador, más: puede asignar roles (CRUD
    de usuarios), ve las observaciones internas de **cualquier** caso, y es
    el único rol que puede **eliminar un caso** (botón "Eliminar caso" en
    la cabecera del detalle, solo visible para este rol).
  - **Compañía**: vinculado a una aseguradora puntual (campo
    "Aseguradora" en su usuario). Solo puede **ver** (nunca crear/editar)
    los casos de esa aseguradora, y nunca ve observaciones internas ni
    puede tocar catálogos. Esto se aplica con RLS en la base de datos
    (`0004_roles.sql`), no solo en la interfaz — un usuario compañía no
    puede ver otros casos ni editar nada aunque llame directo a la API.
- **Rediseño visual**: paleta de dos tonos — navy (`brand`, estructura,
  header, links, marca) + verde (`accent`, botones de acción principal),
  tipografía Poppins bold para títulos (`font-heading`) + Inter para el
  resto, componentes (`card`, `btn`, `input`, `badge`) pulidos. Interfaz
  responsiva: menú hamburguesa en mobile, tablas con scroll horizontal en
  pantallas chicas, formularios que pasan a una sola columna.
- **Vista mobile del caso** (`CasoDetailMobile.tsx`, se activa por ancho de
  pantalla): cabecera fija con dominio/estado y tabs Resumen/Bitácora/
  Documentos, con navegación inferior propia (`MobileNav.tsx`, con acceso
  rápido a foto del dominio/observación/bitácora). Tiene un botón
  **"← Volver"** visible en el encabezado (antes solo se podía volver con
  el gesto de deslizar, no siempre intuitivo) — usa el historial de
  navegación si lo hay, o cae a `/casos` si se entró por un enlace
  directo.

- **Rentabilidad / módulo financiero (Fases 1 y 2)**: página dedicada
  `/casos/[id]/rentabilidad` (accesible desde un resumen compacto —
  Ingresos/Egresos/Ganancia neta — en el detalle del caso; oculta para el
  rol compañía), adaptada de un sistema propio del usuario
  (`tf3040-plataforma`), tratando cada `caso` como la unidad de
  "operación" financiera:
  - **Movimientos** (`movimientos_caso`): ingresos/egresos tipados por el
    catálogo abierto **Conceptos de movimiento** (`/catalogos/conceptos-movimiento`,
    precargado con Cobro a la aseguradora, Cobro al desarmadero, Pago
    a la compañía, Honorarios por Gestoría, Informes de dominio/multas/
    patentes/Ingeniero, Correo/moto envío, Otro — no incluye "Pago al
    desarmadero": a él solo se le cobra, nunca se le paga).
  - **Configuración comercial por aseguradora** (`/catalogos/aseguradoras`,
    tabla `comercial_aseguradora`): % que se le cobra al desarmadero
    (sobre Valor InfoAuto) y % que se le paga a la compañía (sobre Valor
    InfoAuto o Suma Asegurada, a elección) — el formulario de carga de
    movimientos sugiere el monto automático según estos %, editable a
    mano si hace falta.
  - **Valor InfoAuto**: nuevo campo en "Datos económicos" de la cabecera
    del caso, al lado de Suma asegurada.
  - **Facturas y cobros** (comprobantes internos, no fiscales — no se
    usa Contabilium): se agrupan movimientos de ingreso sin facturar en
    una factura (numerada, autonumerada) hacia un receptor (compañía o
    desarmadero), con fecha de vencimiento y forma de pago
    (`facturas.fecha_vencimiento`/`forma_pago`, `0035`), y se registran
    cobros parciales o totales contra ella; el estado (Pendiente/Cobrado
    parcial/Cobrado total) se recalcula solo. Una factura sin cobros ni
    notas de crédito se puede eliminar (sus movimientos vuelven al pool
    de "sin facturar"). Cada **cobro individual** también se puede
    **eliminar** (`DELETE /api/facturas/[id]/cobros/[cobroId]`, revierte
    el saldo del anticipo si el cobro vino de uno) — pensado para
    corregir un cobro cargado por error contra la factura equivocada
    (por ejemplo, facturada a "Compañía" cuando el receptor real era el
    desarmadero), sin tener que tocar la base a mano.
  - **Orden de cobro (PDF)**, solo para facturas a **desarmadero**: botón
    "Descargar detalle" en la factura ya creada
    (`GET /api/facturas/[id]/orden-cobro`,
    `src/lib/documentos/ordenCobroDesarmadero.ts`, con `pdf-lib`) que
    arma un comprobante con los datos del desarmadero, tipo de baja,
    Valor InfoAuto, y el detalle de cada servicio/movimiento facturado
    (itemizado, con su monto) — "Valor otros" suma específicamente los
    movimientos con concepto "Otro" (agregado en `0035` para esto), no
    todo lo que no sea "Cobro al desarmadero".
  - **Anticipos** (`anticipos`): saldo a favor de un tercero (compañía o
    desarmadero) que no queda atado a un caso puntual — se registra desde
    `/cuenta-corriente` y se puede aplicar contra cualquier factura
    pendiente de ese mismo tercero, en cualquier caso, no solo el de
    origen.
  - **Notas de crédito** (`notas_credito`): ajustan/nettean el saldo
    pendiente de una factura ya emitida (error de facturación, descuento)
    sin borrarla ni tocar los movimientos que la originaron.
  - **Ingresos = plata efectivamente cobrada**: la cifra de "Ingresos" (y
    por lo tanto "Ganancia neta") en la ficha del caso, la página de
    rentabilidad y el Panel se calcula sobre cobros + notas de crédito
    realmente registrados contra facturas — no sobre lo devengado al
    cargar un movimiento. Un ingreso cargado pero todavía sin facturar o
    sin cobrar sigue viéndose en la lista de movimientos, pero no suma a
    la ganancia hasta que haya un cobro real.
  - **Control documental atado al estado financiero**: el evento de
    bitácora "Envío de documentación Cía" no se puede completar si el
    caso no está saldado (todas sus facturas en Cobrado total), salvo que
    un administrador autorice una excepción con motivo (columnas
    `bitacora.excepcion_financiera`/`motivo_excepcion`), validado tanto en
    el cliente como en el servidor.
  - **Egresos: pagado / pendiente de pago** (`movimientos_caso.pagado`):
    al cargar un egreso se puede marcar si ya se pagó o queda pendiente
    (por defecto, pendiente); un badge clickeable en la lista de
    movimientos permite cambiar el estado en cualquier momento
    (`MovimientoPagadoToggle`, reutilizado en la ficha del caso y en
    Seguimiento financiero).
  - **Cuenta corriente** (`/cuenta-corriente`): por cada compañía/
    desarmadero, fila resumen (facturado, cobrado —incluye notas de
    crédito—, saldo, anticipos disponibles) desplegable a una tabla con
    el detalle de cada factura: N°, caso (con link), dominio y
    marca/modelo/año del vehículo, servicio facturado, fecha, cobrado,
    saldo y estado. Botón **"Descargar reporte (CSV)"** dentro de cada
    tercero desplegado (`GET /api/cuenta-corriente/export?tipo=...&id=...`),
    una fila por factura con el detalle de sus cobros y notas de crédito.
  - **Seguimiento financiero** (`/seguimiento-financiero`): por cada
    caso con movimientos o facturas cargadas, desplegable con el detalle
    de sus facturas pendientes de cobro y sus egresos cargados (con su
    estado pagado/pendiente, editable ahí mismo); totales generales de
    pendiente por cobrar, pendiente por pagar y ya pagado arriba de todo.
    Sección aparte **"Casos cerrados pendientes de pago a compañía"**:
    agrupados por compañía/mes, **solo casos 04D / 04 Digital**
    (`TIPOS_BAJA_PAGO_COMPANIA` en `src/app/seguimiento-financiero/page.tsx`
    — este reporte es específico de ese trámite, a pedido del usuario)
    donde el movimiento "Pago a la compañía" todavía no está cargado o
    está cargado pero sin tildar como pagado, con botón de exportación a
    CSV (`GET /api/seguimiento-financiero/pendientes-pago-compania/export`,
    mismo filtro de tipo de baja) con siniestro, dominio, marca/modelo/año,
    desarmadero, trámitador, **tipo de baja**, valor restos y fecha de
    cierre.
  - **Panel → Rentabilidad**: totales de ingresos (cobrados)/egresos
    (pagados)/ganancia neta sobre los casos ya filtrados, más una lista
    de facturas pendientes de cobro. Además, una tabla aparte **"Ganancia
    neta por mes"** (casos cerrados, agrupados por mes de cierre): a
    diferencia de la tarjeta de arriba, acá los ingresos son **todo lo
    facturado** (cobrado o no) y los egresos son **todos los cargados**
    (pagados y pendientes de pago) — es una mirada devengada mes a mes,
    útil para ver qué se generó ese mes aunque todavía no se haya
    cobrado/pagado, distinta a propósito de la mirada de caja de la
    tarjeta de Rentabilidad. Ambos cálculos conviven en
    `src/lib/panelData.ts` con mapas separados (`ingresosPorCaso`/
    `egresosPorCaso` para la tarjeta en base caja, `facturadoPorCaso`/
    `egresosTotalesPorCaso` para la tabla mensual en base devengado) para
    no mezclar los dos criterios.
  - Es información **100% interna**: el rol compañía no tiene ningún
    acceso a nada de esto, ni por pantalla ni por API directa (RLS real).
  - Quedan pendientes para próximas sesiones: RBAC granular en paralelo
    al sistema de roles actual (Fase 3) y notificaciones automáticas
    WhatsApp/Email (Fase 4).

No incluido todavía (a propósito, según el `CLAUDE.md`): las fases 3-4 del
módulo financiero recién descriptas, y roles separados internos
(gestor/tramitador dentro del equipo propio — distinto de los roles de
acceso operador/administrador/compañía, que sí están implementados, y
también distinto del "Gestor de campo" de arriba, que es una persona
externa sin cuenta en el sistema, no un rol interno del equipo).

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Creá un proyecto en https://supabase.com.
2. Abrí el **SQL Editor** y ejecutá, en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed_demo.sql` (opcional, datos de prueba)
   - `supabase/migrations/0003_auth.sql` (necesaria para el login)
   - `supabase/migrations/0004_roles.sql` (necesaria para los roles)
   - `supabase/migrations/0005_solo_admin_borra_casos.sql` (restringe el
     borrado de casos solo a administrador)
   - `supabase/migrations/0006_aprobacion_pendiente.sql` (cuentas nuevas
     quedan pendientes de aprobación, sin acceso a nada)
   - `supabase/migrations/0007_localidad_provincia_asegurado.sql` (agrega
     localidad y provincia al asegurado, para la autorización de retiro)
   - `supabase/migrations/0008_autorizacion_traslado.sql` (agrega póliza/
     ítem al caso, entre calles/partido al asegurado, y provincia al
     desarmadero, para la autorización de traslado)
   - `supabase/migrations/0009_tercero_suma_asegurada.sql` (agrega el
     tercero autorizado a entregar la unidad y la suma asegurada del caso)
   - `supabase/migrations/0010_estados_por_evento.sql` (amplía los estados
     posibles del caso para que cada evento clave tenga su propio paso)
   - `supabase/migrations/0011_registros_dnrpa.sql` (carga masiva de 835
     registros seccionales de AUTOMOTOR de todo el país — este archivo es
     grande, puede tardar unos segundos en correr)
   - `supabase/migrations/0012_simplificar_registros.sql` (saca dirección
     y teléfono del catálogo de registros, se queda solo con número,
     denominación y provincia)
   - `supabase/migrations/0013_productor_tramitador.sql` (agrega productor
     y trámitador de la compañía al caso)
   - `supabase/migrations/0014_numero_caso.sql` (agrega el número de caso
     correlativo, autonumerado)
   - `supabase/migrations/0015_historial_cambios.sql` (tabla de auditoría:
     quién hizo qué cambio y cuándo, por caso)
   - `supabase/migrations/0016_numero_caso_demo.sql` (marca los casos de
     demo con numero_caso = 0, para no ocupar lugar en la numeración real)
   - `supabase/migrations/0017_recalcular_numero_caso.sql` (recálculo
     puntual, una sola vez, para sacar huecos existentes — de acá en más
     los huecos por futuros borrados NO se vuelven a recalcular solos)
   - `supabase/migrations/0018_siguiente_numero_caso.sql` (función para
     asignar el próximo número real cuando un caso deja de ser demo)
   - `supabase/migrations/0019_fix_duplicado_numero_caso.sql` (corrige un
     número duplicado que se generó por un ajuste manual anterior que
     dejó la secuencia desincronizada, y la resincroniza)
   - `supabase/migrations/0020_recalcular_estados.sql` (recalcula
     retroactivamente el estado de todos los casos según sus eventos de
     bitácora ya completados, sin retroceder nunca uno más avanzado)
   - `supabase/migrations/0021_modulo_gestor.sql` (catálogo de gestores,
     `gestor_id`/`token_gestor` en casos, nuevas categorías de documentos
     para lo que carga el gestor, y el bucket de Storage `documentos-casos`)
   - `supabase/migrations/0022_recalcular_estados_v2.sql` (recalcula el
     estado de todos los casos con el criterio ampliado de avance
     automático — ver más abajo)
   - `supabase/migrations/0023_estado_gestor_asignado.sql` y
     `0024_estado_baja_patentes_pendiente.sql` (dos estados nuevos:
     "Gestor Asignado" y "Baja de Patentes Pendiente")
   - `supabase/migrations/0025_gruero_traslado.sql` (datos del gruero
     dentro del evento "Traslado") y `0027_token_gruero.sql` (enlace
     público de solo lectura para el gruero, `/gr/<token>`)
   - `supabase/migrations/0026_recalcular_numero_caso_v2.sql` (recálculo
     puntual de `numero_caso` para sacar huecos)
   - `supabase/migrations/0028_rentabilidad.sql` (módulo financiero Fase
     1: `comercial_aseguradora`, `conceptos_movimiento`,
     `movimientos_caso`, `facturas`, `cobros`, vista `cuenta_corriente`,
     `casos.valor_infoauto`)
   - `supabase/migrations/0029_anticipos_notas_credito.sql` (módulo
     financiero Fase 2: `anticipos`, `notas_credito`,
     `cobros.anticipo_id`, `bitacora.excepcion_financiera`/
     `motivo_excepcion`, recreación de la vista `cuenta_corriente`)
   - `supabase/migrations/0030_movimiento_pagado.sql`
     (`movimientos_caso.pagado`: distingue un egreso ya pagado de uno
     pendiente de pago)
   - `supabase/migrations/0031_logo_aseguradora.sql`
     (`aseguradoras.logo_path` + bucket privado `logos-aseguradoras`,
     para el encabezado de la Autorización de retiro y traslado)
   - `supabase/migrations/0032_formulario_baja.sql` (datos de la persona
     asignada al evento "Formulario de Baja" y `token_formulario_baja`,
     enlace público de carga para el 04D en `/fb/<token>`, y la categoría
     de documento `formulario_baja`)
   - `supabase/migrations/0033_recalcular_numero_caso_v3.sql` y
     `0034_recalcular_numero_caso_v4.sql` (mismo recálculo puntual que
     `0017`/`0026`, para sacar huecos de `numero_caso` que se volvieron a
     generar)
   - `supabase/migrations/0035_orden_cobro_desarmadero.sql`
     (`facturas.fecha_vencimiento`/`forma_pago`, y el concepto "Otro" de
     tipo ingreso, para la Orden de cobro en PDF de una factura a
     desarmadero)
   - `supabase/migrations/0036_desarmadero_en_evento.sql`
     (`bitacora.desarmadero_id`: el desarmadero se asigna ahora desde el
     propio evento "Asignación de desarmadero", no desde un campo suelto
     en la cabecera del caso)
   - `supabase/migrations/0037_encuesta_satisfaccion.sql` (tabla
     `encuestas_satisfaccion`, para la encuesta de satisfacción por
     WhatsApp) y `0038_encuesta_satisfaccion_unique_caso.sql` (constraint
     único de `caso_id`, para que el alta get-or-create sea atómica y no
     pueda duplicar filas)
   - `supabase/migrations/0039_gestores_direccion_email_zona.sql`
     (agrega dirección, email y zona de cobertura al catálogo de
     gestores)
   - `supabase/migrations/0040_gestores_token_acceso.sql` (agrega
     `token_acceso`, identidad persistente por gestor para el hub de
     "Ver todas mis asignaciones" en `/gestor/<token>`)
3. Copiá la **Project URL** y la **anon/publishable key** desde
   Project Settings → API. Copiá también la **service_role key** (misma
   pantalla, es secreta) — la necesita el enlace público del gestor.

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Completá `.env.local` con la URL, la anon key y la **service_role key**
(`SUPABASE_SERVICE_ROLE_KEY`) de tu proyecto de Supabase. Esta última es
secreta — nunca lleva el prefijo `NEXT_PUBLIC_` y no debe exponerse al
navegador; en Vercel hay que agregarla también como variable de entorno del
proyecto.

Completá también `GMAIL_USER`/`GMAIL_APP_PASSWORD` (cuenta de Gmail usada
para las notificaciones por mail — ver "Notificaciones por mail" arriba).
`GMAIL_APP_PASSWORD` **no** es la contraseña normal de la cuenta: hay que
activar la verificación en 2 pasos en esa cuenta de Gmail y generar una
"Contraseña de aplicación" (myaccount.google.com → Seguridad →
Contraseñas de aplicaciones → app "Correo"). Sin estas dos variables, el
resto de la app funciona igual — el envío de mail simplemente falla de
forma controlada (se ve el error en el selector de notificación, no
rompe nada más).

### 3. Instalar dependencias y correr en desarrollo

```bash
npm install
npm run dev
```

La app queda en http://localhost:3000, pero **primero hay que crear un
usuario** (paso 4) o vas a quedar dando vueltas en `/login` sin poder entrar.

### 4. Crear el primer usuario para poder loguearse

Como el login usa Supabase Auth, hay que crear la cuenta ahí (no hay
pantalla de "registrarse" en la app, a propósito, para que no cualquiera
pueda crearse una cuenta). Desde la migración `0006`, cada cuenta nueva
queda **pendiente de aprobación** (sin rol) hasta que alguien se lo
asigne — y como todavía no hay ningún administrador, para la primera
cuenta hay que hacer ese primer paso a mano por SQL:

1. En el panel de Supabase: **Authentication → Users → Add user** → cargá
   tu email y una contraseña → **Create user**. Esto dispara el trigger
   que crea tu fila en `usuarios` automáticamente (sin rol todavía).
2. Copiá el **User UID** que te muestra (un código largo tipo
   `a1b2c3d4-...`).
3. En el **SQL Editor** de Supabase, corré (reemplazando el UID por el
   que copiaste):
   ```sql
   update usuarios set rol = 'administrador' where auth_user_id = 'PEGÁ-EL-UID-ACÁ';
   ```
4. Ahora sí, entrá a `/login` con tu email y contraseña — ya vas a tener
   rol de administrador y acceso completo.
5. Para el resto del equipo, ya no hace falta este paso manual: que cada
   persona se loguee una vez (con Google o con una cuenta que le crees en
   Authentication → Users), y su fila va a aparecer sola en
   **Catálogos → Usuarios** con el Rol en blanco. Editala y asignale:
   - `Operador` para el equipo que gestiona los casos día a día.
   - `Administrador` para quien vaya a asignar roles y necesite ver todas
     las observaciones internas.
   - `Compañía` para el contacto de una aseguradora puntual — en ese caso,
     elegí también su **Aseguradora**. Va a poder loguearse y ver solo los
     casos de esa aseguradora, sin observaciones internas ni catálogos.

Mientras una cuenta no tenga rol asignado, ve una pantalla de "Cuenta
pendiente de aprobación" y no puede leer nada del sistema (ni casos ni
catálogos) — es una restricción real de la base de datos, no solo de la
pantalla.

## Autenticación — cómo funciona

- El middleware (`src/middleware.ts`) exige sesión iniciada para **todas**
  las rutas y toda la API. Si no hay sesión, redirige a `/login` (páginas)
  o devuelve 401 (API). Las rutas `/login` y `/auth/*` quedan afuera de
  esta exigencia (son las que permiten loguearse).
- **RLS por rol**: cada tabla tiene políticas que dependen del rol del
  usuario logueado (`operador` / `administrador` / `compania`) — ver
  `0004_roles.sql` y `0005_solo_admin_borra_casos.sql`. El rol "compañía"
  solo lee los casos de su propia aseguradora.
- **Observaciones internas**: el campo `observacion` de un evento de
  bitácora marcado como "interna" se pone en `null` **en el servidor**
  antes de mandarlo al navegador, salvo que quien esté logueado sea
  administrador o el responsable de ese caso puntual.
- **Cuentas nuevas quedan pendientes de aprobación**: cada vez que alguien
  se loguea por primera vez (Google o email/contraseña), un trigger le crea
  automáticamente una fila en `usuarios` **sin rol asignado**. Mientras no
  tenga rol, ve una pantalla de "Cuenta pendiente de aprobación" y no puede
  leer absolutamente nada (ni siquiera los catálogos) — esto se aplica con
  RLS, no es solo una pantalla bonita. Un administrador tiene que entrar a
  **Catálogos → Usuarios**, buscar esa fila nueva (va a aparecer con Rol en
  blanco) y asignarle Operador / Administrador / Compañía para habilitarla.
- **Login con Google** (opcional, además del de email/contraseña): ver la
  sección siguiente para activarlo. El flujo de aprobación de arriba
  aplica igual sea cual sea el método de login.

## Login con Google (opcional)

Esto requiere configurar credenciales en Google Cloud y activarlas en
Supabase. El código ya está listo (botón "Continuar con Google" en
`/login` + ruta `/auth/callback`); falta esta parte de configuración.

1. **Google Cloud Console** (https://console.cloud.google.com):
   - Creá un proyecto (o usá uno existente) → **APIs & Services → OAuth
     consent screen**: completá los datos básicos (nombre de la app, email
     de soporte). Con "External" alcanza si no usan Google Workspace.
   - **APIs & Services → Credentials → Create Credentials → OAuth client
     ID** → tipo **"Web application"**.
   - En **Authorized redirect URIs**, agregá:
     `https://TU-PROYECTO.supabase.co/auth/v1/callback`
     (reemplazá `TU-PROYECTO` por el ID de tu proyecto de Supabase; ese
     dominio es el mismo que usás como `NEXT_PUBLIC_SUPABASE_URL`, sin el
     `https://` duplicado).
   - Guardá y copiá el **Client ID** y el **Client Secret** que te muestra.

2. **Supabase → Authentication → Providers → Google**:
   - Activá el toggle de Google.
   - Pegá el Client ID y el Client Secret del paso anterior.
   - Guardá.

3. **Supabase → Authentication → URL Configuration**:
   - En "Site URL" poné la URL de tu app en producción (ej:
     `https://bajas-registral.vercel.app`).
   - En "Redirect URLs" agregá esa misma URL seguida de `/**` (ej:
     `https://bajas-registral.vercel.app/**`) para que Supabase acepte
     redirigir de vuelta a tu app después del login con Google. Si
     también probás en `http://localhost:3000`, agregá esa URL también.

4. Probá el botón "Continuar con Google" en `/login`. La primera vez que
   alguien entra así, Supabase le crea una cuenta nueva en
   Authentication → Users; hay que vincularla igual que cualquier otra
   (copiar su User UID y pegarlo en `/catalogos/usuarios`, asignándole un
   rol) para que pueda ver algo más que los catálogos.

## Notas importantes

- **Autorización de retiro y traslado**: los casos creados antes de las
  migraciones `0007`/`0008` no van a tener localidad/provincia/entre
  calles/partido/póliza cargados (esos campos no existían), así que esos
  datos van a salir en blanco en el documento generado para casos viejos.
  Para casos nuevos se completan en el formulario de alta. El documento
  no lleva el logo/membrete de la aseguradora (solo el nombre en texto);
  si quieren ese detalle visual, se puede sumar más adelante subiendo un
  logo por aseguradora.
- **Vencimientos**: no hay una tabla separada de "vencimientos"; la agenda
  usa el `fecha_fin` de cada evento de bitácora. Si más adelante hace falta
  distinguir "vencimiento" de "fecha de fin real", conviene sumar una
  columna `fecha_vencimiento` en vez de reusar `fecha_fin`.
- **Enlace del gestor**: es permanente mientras el caso siga con ese
  `gestor_id` asignado; si se comparte por error, "Regenerar enlace" en la
  cabecera del caso lo invalida sin necesitar sacar al gestor del caso. Al
  reasignar a otro gestor se regenera solo. El `token_acceso` del hub
  (`/gestor/<token>`) es un token distinto, por persona — no se toca al
  regenerar el enlace de un caso puntual.
- Los tipos TypeScript en `src/types/database.ts` están escritos a mano; si
  se modifica el esquema SQL hay que actualizarlos (o generarlos con
  `supabase gen types typescript`).

## Próximos pasos sugeridos (ver `CLAUDE.md`)

- Módulo financiero — Fase 3: RBAC granular en paralelo al sistema de
  roles actual. (Fases 1 y 2 ya están implementadas — ver arriba.)
- Módulo financiero — Fase 4: notificaciones automáticas por
  WhatsApp/Email vía Edge Functions + cron (distinto de las
  notificaciones por mail y la encuesta de satisfacción ya
  implementadas, que son manuales — la persona responsable dispara el
  envío a mano cada vez).
- Roles internos separados (gestor/tramitador dentro del equipo
  propio — el modelo ya está preparado para sumarlos sin romper nada).
