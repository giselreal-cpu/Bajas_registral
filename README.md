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
  (configurable en `DIAS_SIN_MOVIMIENTO` en `src/app/panel/page.tsx`), y
  próximos vencimientos.
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
- **Autenticación básica** (Supabase Auth): login con email/contraseña,
  todas las rutas y toda la API requieren sesión iniciada.
- **Roles de usuario** (`operador`, `administrador`, `compania`), asignables
  desde `/catalogos/usuarios`:
  - **Operador**: acceso normal de siempre (crear/editar casos, catálogos,
    bitácora, documentos). No ve observaciones internas salvo que sea el
    responsable del caso puntual.
  - **Administrador**: igual que operador, más: puede asignar roles (CRUD
    de usuarios) y ve las observaciones internas de **cualquier** caso, sea
    o no el responsable.
  - **Compañía**: vinculado a una aseguradora puntual (campo
    "Aseguradora" en su usuario). Solo puede **ver** (nunca crear/editar)
    los casos de esa aseguradora, y nunca ve observaciones internas ni
    puede tocar catálogos. Esto se aplica con RLS en la base de datos
    (`0004_roles.sql`), no solo en la interfaz — un usuario compañía no
    puede ver otros casos ni editar nada aunque llame directo a la API.
- **Rediseño visual**: paleta de dos tonos — navy (`brand`, estructura,
  header, links, marca) + verde (`accent`, botones de acción principal),
  tipografía Poppins bold para títulos (`font-heading`) + Inter para el
  resto, componentes (`card`, `btn`, `input`, `badge`) pulidos.

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
pueda crearse una cuenta):

1. En el panel de Supabase: **Authentication → Users → Add user** → cargá
   email y contraseña → **Create user**.
2. Copiá el **User UID** que te muestra (un código largo tipo
   `a1b2c3d4-...`).
3. En la app (una vez que puedas entrar, o directo en la tabla `usuarios`
   desde Supabase si es la primera vez): andá a **Catálogos → Usuarios**,
   creá (o editá) la fila de esa persona, y pegá ese UID en el campo
   **"ID de cuenta (Supabase Auth)"**.
4. Repetí esto por cada persona del equipo que necesite entrar al sistema.
   Al crear (o editar) su fila en **Catálogos → Usuarios**, elegí también
   su **Rol**:
   - `Operador` para el equipo que gestiona los casos día a día.
   - `Administrador` para vos (o quien vaya a asignar roles y necesite ver
     todas las observaciones internas).
   - `Compañía` para el contacto de una aseguradora puntual — en ese caso,
     elegí también su **Aseguradora** en el campo correspondiente. Va a
     poder loguearse y ver solo los casos de esa aseguradora, sin
     observaciones internas ni acceso a catálogos.

Sin este vínculo, la persona puede loguearse (si tiene usuario y
contraseña) pero el sistema no la va a reconocer como "responsable" de
ningún caso a los fines de las observaciones internas.

## Autenticación — cómo funciona

- El middleware (`src/middleware.ts`) exige sesión iniciada para **todas**
  las rutas y toda la API. Si no hay sesión, redirige a `/login` (páginas)
  o devuelve 401 (API).
- **RLS**: todas las tablas exigen `auth.role() = 'authenticated'` para
  cualquier operación (ver `0003_auth.sql`). Ya no hay políticas
  permisivas para anónimos.
- **Observaciones internas**: el campo `observacion` de un evento de
  bitácora marcado como "interna" se pone en `null` **en el servidor**
  (en las rutas de la API) antes de mandarlo al navegador, salvo que quien
  esté logueado sea el responsable de ese caso. Esto es real, no se puede
  esquivar editando el navegador.
- **Limitación actual**: solo hay un nivel de acceso (cualquier cuenta
  autenticada puede ver/crear/editar cualquier caso, catálogo, etc.). La
  única restricción puntual es la de observaciones internas por
  responsable. Si más adelante necesitan roles (ej: un admin que vea todo,
  gestores que solo vean sus propios casos), eso es una extensión de este
  mismo esquema de auth, no un cambio de raíz.

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
