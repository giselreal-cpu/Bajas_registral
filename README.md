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

No incluido todavía (a propósito, según el `CLAUDE.md`): autenticación,
módulo financiero, notificaciones automáticas, roles separados, agenda y
panel de control.

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

- **RLS**: las tablas tienen Row Level Security habilitado con políticas
  permisivas (`allow_all_*`) porque todavía no hay autenticación (ver
  "Estado actual del proyecto" en `CLAUDE.md`). Cuando se implemente
  autenticación básica, hay que reemplazar esas políticas por reglas que
  validen `auth.uid()` / rol del usuario.
- **Catálogos**: `aseguradoras`, `desarmaderos`, `registros_automotores`,
  `tipos_baja` y `usuarios` no tienen todavía una pantalla de alta en la UI;
  se cargan por ahora directamente en Supabase (Table Editor o SQL). Agregar
  ese CRUD de catálogos es un buen próximo paso.
- **Documentos**: el campo `url` se carga a mano. Para subir archivos reales
  conviene crear un bucket en Supabase Storage y, al subir el archivo desde
  el formulario, guardar acá la URL pública o firmada resultante.
- Los tipos TypeScript en `src/types/database.ts` están escritos a mano para
  que coincidan con el esquema SQL; si se modifica el esquema hay que
  actualizarlos (o generarlos con `supabase gen types typescript`).

## Próximos pasos sugeridos (ver `CLAUDE.md`)

- Autenticación básica.
- Agenda / vencimientos.
- Panel de control (casos por estado, próximos vencimientos).
- CRUD de catálogos (aseguradoras, desarmaderos, registros, tipos de baja,
  usuarios).

