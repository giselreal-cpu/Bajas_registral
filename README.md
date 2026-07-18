# Bajas Registrales por Siniestro

MVP en Next.js (App Router) + TypeScript + Supabase (Postgres), siguiendo el
`CLAUDE.md` del proyecto.

## Qué incluye este MVP

- Modelo de datos completo (`supabase/migrations/0001_init.sql`):
  `aseguradoras`, `asegurados`, `vehiculos`, `desarmaderos`,
  `registros_automotores`, `tipos_baja`, `usuarios`, `casos`, `bitacora`,
  `documentos`.
- CRUD de casos:
  - Listado con filtro por estado y por número de siniestro (`/casos`).
  - Alta de caso, creando en el mismo paso el asegurado y el vehículo
    (`/casos/nuevo`).
  - Vista de detalle (`/casos/[id]`) con:
    - **Cabecera** editable: estado, rama, tipo de trámite, tipo de baja,
      responsable, desarmadero, registro automotor, deudas, fechas y
      observaciones.
    - **Bitácora**: alta de eventos (tipo, observación, fechas, si es
      interna) y marcado de completado/pendiente.
    - **Documentos**: registro de imágenes del dominio y documentación para
      la compañía (por ahora vía URL; se puede sumar upload real a Supabase
      Storage más adelante).

- CRUD de catálogos (`/catalogos`): aseguradoras, desarmaderos, registros
  automotores, tipos de baja y usuarios, cada uno con alta, edición inline y
  borrado.
- Agenda de vencimientos (`/agenda`): junta los eventos de bitácora
  pendientes de todos los casos abiertos y los agrupa en Vencidos / Próximos
  7 días / Más adelante / Sin fecha de vencimiento, con filtro por
  responsable y marcado de completado sin salir de la pantalla.
- Panel de control (`/panel`, página de inicio): casos totales/abiertos/
  cerrados, casos por estado con barra y link al listado filtrado, y los
  próximos 8 vencimientos con link directo al caso.

No incluido todavía (a propósito, según el `CLAUDE.md`): autenticación,
módulo financiero, notificaciones automáticas y roles separados.

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Creá un proyecto en https://supabase.com.
2. Abrí el **SQL Editor** y ejecutá, en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed_demo.sql` (opcional, datos de prueba)

   O bien, si usás la CLI de Supabase: `supabase db push` desde la carpeta
   del proyecto (con el CLI ya vinculado a tu proyecto).

3. Copiá la **Project URL** y la **anon public key** desde
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

La app queda disponible en http://localhost:3000 (redirige a `/casos`).

## Notas importantes

- **Vencimientos**: el modelo de datos no tiene una tabla separada de
  "vencimientos"; la agenda usa el `fecha_fin` de cada evento de bitácora
  como su fecha de vencimiento. Si en algún momento se necesita distinguir
  "vencimiento" de "fecha de fin real del evento", conviene sumar una
  columna nueva (`fecha_vencimiento`) en vez de reusar `fecha_fin`.

- **RLS**: las tablas tienen Row Level Security habilitado con políticas
  permisivas (`allow_all_*`) porque todavía no hay autenticación (ver
  "Estado actual del proyecto" en `CLAUDE.md`). Cuando se implemente
  autenticación básica, hay que reemplazar esas políticas por reglas que
  validen `auth.uid()` / rol del usuario.
- **Catálogos**: `aseguradoras`, `desarmaderos`, `registros_automotores`,
  `tipos_baja` y `usuarios` ya tienen su propia pantalla de alta/edición/
  borrado en `/catalogos`.
- **Documentos**: el campo `url` se carga a mano. Para subir archivos reales
  conviene crear un bucket en Supabase Storage y, al subir el archivo desde
  el formulario, guardar acá la URL pública o firmada resultante.
- Los tipos TypeScript en `src/types/database.ts` están escritos a mano para
  que coincidan con el esquema SQL; si se modifica el esquema hay que
  actualizarlos (o generarlos con `supabase gen types typescript`).

## Próximos pasos sugeridos (ver `CLAUDE.md`)

- Autenticación básica.
