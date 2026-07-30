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
    **compañía/aseguradora**, además del filtro por estado (`/casos`).
  - Alta de caso, creando en el mismo paso el asegurado y el vehículo
    (`/casos/nuevo`).
  - Vista de detalle (`/casos/[id]`) con cabecera organizada en secciones
    con título propio (Datos del caso, Trámite, Vehículo, Datos
    económicos, Asegurado / titular, Tercero autorizado), todas editables:
    número de siniestro, número de póliza/ítem, **aseguradora**, nombre y
    contacto del productor, nombre y email del trámitador de la compañía,
    dominio/marca/modelo/año del vehículo, suma asegurada, estado, rama,
    tipo de trámite, tipo de baja, responsable, desarmadero, registro,
    deudas, fechas, los datos propios del asegurado, y el tercero
    autorizado a entregar la unidad. Editar el vehículo o los datos del
    asegurado actualiza `vehiculos`/`asegurados` por separado
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
  **compañía/aseguradora, mes de ingreso y tipo de baja** (afecta las
  tarjetas de totales, "Casos por estado" y el dashboard de tiempos de
  trámite — por ejemplo, para ver cuánto tarda en promedio un 04C
  específicamente. No hay filtro por estado ahí porque esa misma sección
  ya desglosa por estado — sería redundante. El resto del panel
  —vencimientos, casos sin movimiento— sigue mostrando todo, ya que son
  alertas operativas, no un reporte), casos totales/abiertos/
  cerrados, casos por estado, alerta de **casos sin movimiento hace 7+ días**
  (configurable en `DIAS_SIN_MOVIMIENTO` en `src/app/panel/page.tsx`, solo
  aparece si hay algún caso en esa situación), y una lista combinada de
  **"Próximos vencimientos"** que junta los eventos de bitácora con fecha
  de vencimiento cargada *y* los casos sin movimiento hace 7+ días (aunque
  no tengan ninguna fecha cargada) — los vencidos aparecen primero, y un
  dashboard de tiempos de trámite (visible para operador/administrador,
  oculto para el rol compañía): tiempo promedio de trámite completo (fecha
  de ingreso → fecha de cierre) y tiempo promedio entre "Presentación de
  Baja" completada y el cierre, con tabla de los últimos casos cerrados.
- **Avance automático de estado**: el catálogo de estados del caso tiene un
  paso propio por cada evento clave de la bitácora (`0010_estados_por_evento.sql`),
  así el seguimiento es más preciso. Al marcar como completado alguno de
  estos eventos, el `estado` del caso avanza solo (se ve reflejado en el
  Panel y en el listado de Casos):
  - "Petición de Informes" → Informes solicitados
  - "Contacto con el asegurado" → En verificación
  - "Autorización de traslado" → Autorización de traslado
  - "Asignación de desarmadero" → Desarmadero asignado
  - "Traslado" → Traslado realizado
  - "Formulario de Baja" → Formulario de baja presentado
  - "Presentación de Baja" → Presentado en el registro
  - "Envío de documentación Cía" → Documentación enviada a la Cía
  - "Cierre de Caso" → Cerrado (completa `fecha_cierre` con la fecha de hoy
    si todavía no tenía una)

  "Ingreso de caso" y "Observaciones" no mueven el estado (el primero ya
  arranca en "Iniciado"; el segundo es solo una anotación libre). Solo
  avanza hacia adelante — nunca retrocede el estado automáticamente,
  aunque se destilde un evento ya completado o se complete uno "de una
  etapa anterior" más tarde. Ver `src/lib/estadoAutomatico.ts`. El estado
  se puede seguir cambiando a mano en cualquier momento desde la cabecera
  del caso, esto es un adicional, no un reemplazo.
  **Importante**: este avance solo se dispara en el momento en que se
  completa un evento *desde que existe esta lógica*; no revisa
  retroactivamente eventos que ya estaban completados de antes. Si hace
  falta ponerse al día (por ejemplo, después de una migración de datos
  vieja), correr `0020_recalcular_estados.sql`, que recalcula el estado de
  todos los casos según sus eventos ya completados, sin retroceder nunca
  uno que ya estuviera más avanzado.
  Además, el prerequisito de cada evento (que ya se validaba en el
  navegador) ahora también se valida **en el servidor**
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
  - Tipo de evento por lista desplegable, con un catálogo **cerrado** de 11
    tipos (`src/lib/eventosBitacora.ts`): Ingreso de caso, Petición de
    Informes, Contacto con el asegurado, Autorización de traslado,
    Asignación de desarmadero, Traslado, Formulario de Baja, Presentación
    de Baja, Envío de documentación Cía, Cierre de Caso, Observaciones (sin
    prerequisito, para anotaciones sueltas que no encajan en los otros).
  - Cada tipo tiene su propio prerequisito puntual: "Autorización de
    traslado" requiere "Contacto con el asegurado" completado; "Asignación
    de desarmadero" requiere "Autorización de traslado" completado;
    "Formulario de Baja", "Presentación de Baja", "Envío de documentación
    Cía" y "Cierre de Caso" requieren todos "Asignación de desarmadero"
    completado. No se puede marcar un evento como completado si su
    prerequisito no lo está.
  - Los eventos ya cargados se pueden **editar** (tipo, observación,
    fechas, interna/completada) con el botón "Editar".
  - Las observaciones marcadas como **interna** solo se muestran a quien
    esté logueado como el responsable del caso — ver sección de
    Autenticación abajo, es real (server-side), no un adorno visual.
- **Exportar datos** (`/exportar`): CSV de casos, bitácora y documentos (con
  relaciones ya resueltas, listo para Excel) más un backup completo en JSON
  de todas las tablas.
- **Documentos**: se pueden arrastrar entre "Imagen del dominio" y
  "Documento para la compañía" para corregir la categoría sin borrar y
  volver a cargar, y también se pueden eliminar. Nueva ruta
  `/api/documentos/[id]` (PUT/DELETE).
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
- **Autorización de retiro y traslado** (un solo botón en el detalle del
  caso): genera un .docx descargable con una carta que combina la
  autorización de retiro (con las declaraciones legales de embargo/
  inhibición, multas/deudas siempre a cargo del titular, y estado de
  entrega del vehículo) y la autorización de traslado (origen y destino
  con entre calles/partido/provincia, datos de contacto para coordinarlo,
  y la cláusula de disponibilidad de 20 días corridos), para que alcance
  un solo documento firmado sin necesitar dos cartas separadas. Basado en
  dos modelos reales que nos pasó el usuario
  (`src/lib/documentos/autorizacionRetiro.ts`). Requirió agregar campos
  nuevos: `numero_poliza`/`item_poliza` en casos, `entre_calles`/`partido`
  en asegurados, y `provincia` en desarmaderos. Si en la cabecera del caso
  se carga un **tercero autorizado a entregar la unidad** (nombre, DNI,
  contacto), sus datos **reemplazan** (no se suman) a los del asegurado en
  la sección "quien hará entrega del vehículo", y se agrega una frase que
  autoriza expresamente a esa persona a entregarla en representación del
  asegurado. Si no se carga ningún tercero, esa sección usa los datos del
  asegurado como siempre.
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

No incluido todavía (a propósito, según el `CLAUDE.md`): módulo financiero,
notificaciones automáticas y roles separados internos (gestor/tramitador
dentro del equipo propio — distinto de los roles de acceso operador/
administrador/compañía, que sí están implementados).

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
3. Copiá la **Project URL** y la **anon/publishable key** desde
   Project Settings → API.

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Completá `.env.local` con la URL y la anon key de tu proyecto de Supabase.

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
- **Documentos**: el campo `url` se carga a mano. Para subir archivos reales
  conviene un bucket de Supabase Storage y guardar acá la URL resultante.
- Los tipos TypeScript en `src/types/database.ts` están escritos a mano; si
  se modifica el esquema SQL hay que actualizarlos (o generarlos con
  `supabase gen types typescript`).

## Próximos pasos sugeridos (ver `CLAUDE.md`)

- Módulo financiero (valores InfoAuto, cobros/pagos).
- Notificaciones automáticas.
- Roles internos separados (gestor/tramitador).
- Upload real de archivos a Supabase Storage para la sección de documentos.
