# Bajas Registrales por Siniestro

MVP en Next.js (App Router) + TypeScript + Supabase (Postgres + Auth),
siguiendo el `CLAUDE.md` del proyecto.

## Qué incluye este MVP

- **Modelo de datos completo** (`supabase/migrations/0001_init.sql`):
  `aseguradoras`, `asegurados`, `vehiculos`, `desarmaderos`,
  `registros_automotores`, `tipos_baja`, `usuarios`, `casos`, `bitacora`,
  `documentos`.
- **CRUD de casos**:
  - Listado con filtro por estado y por número de siniestro (`/casos`).
  - Alta de caso, creando en el mismo paso el asegurado y el vehículo
    (`/casos/nuevo`).
  - Vista de detalle (`/casos/[id]`) con cabecera editable (estado, rama,
    tipo de trámite, tipo de baja, responsable, desarmadero, registro,
    deudas, fechas, observaciones), bitácora y documentos.
- **CRUD de catálogos** (`/catalogos`): aseguradoras, desarmaderos, registros
  automotores, tipos de baja y usuarios, cada uno con alta, edición inline y
  borrado.
- **Agenda de vencimientos** (`/agenda`): eventos de bitácora pendientes de
  todos los casos abiertos, agrupados en Vencidos / Próximos 7 días / Más
  adelante / Sin fecha, con filtro por responsable.
- **Panel de control** (`/panel`, página de inicio): casos totales/abiertos/
  cerrados, casos por estado, alerta de **casos sin movimiento hace 7+ días**
  (configurable en `DIAS_SIN_MOVIMIENTO` en `src/app/panel/page.tsx`, solo
  aparece si hay algún caso en esa situación), próximos vencimientos, y un
  **dashboard de tiempos de trámite** (visible para operador/administrador,
  oculto para el rol compañía): tiempo promedio de trámite completo (fecha
  de ingreso → fecha de cierre) y tiempo promedio entre "Presentación de
  Baja" completada y el cierre, con tabla de los últimos casos cerrados.
- **Bitácora**:
  - Tipo de evento por lista desplegable, con un catálogo **cerrado** de 10
    tipos (`src/lib/eventosBitacora.ts`): Ingreso de caso, Petición de
    Informes, Contacto con el asegurado, Autorización de traslado,
    Asignación de desarmadero, Traslado, Formulario de Baja, Presentación
    de Baja, Envío de documentación Cía, Cierre de Caso.
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
