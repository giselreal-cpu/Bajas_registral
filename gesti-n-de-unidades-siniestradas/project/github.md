repo: giselreal-cpu/Bajas_registral
branch: main

## Last sync

date: 2026-08-31T14:47:00Z

### Updated in this project

- Se leyó el modelo de negocio, estados, tipos de evento y pantallas web (Panel, Casos, Detalle, enlace de gestor).
- Se diseñó una app móvil de campo (`App Movil Bajas.dc.html`) con lista de casos, detalle, bitácora y carga de documentos.
- Datos, estados y catálogos tomados literalmente de `src/types/database.ts` y `src/lib/eventosBitacora.ts`.
- Se agregó la vista acotada del gestor de campo (/g/<token>) y la del desarmadero (/fb/<token>: seguimiento + carga del Formulario/04D).

## Screen map

| Pantalla del proyecto | Archivos del repo |
| --- | --- |
| App Movil Bajas — Lista de casos (1a, 1b) | src/app/casos/page.tsx, src/types/database.ts |
| App Movil Bajas — Detalle / Resumen | src/app/casos/[id]/page.tsx, src/types/database.ts |
| App Movil Bajas — Bitácora (1a, 1c) | src/lib/eventosBitacora.ts, src/app/casos/[id]/page.tsx |
| App Movil Bajas — Documentos / carga rápida (1a, 1d) | src/app/g/[token]/page.tsx, src/types/database.ts (CATEGORIAS_GESTOR) |
| App Movil Bajas — Gestor de campo (2a, 2b) | src/app/g/[token]/page.tsx, src/app/g/[token]/UploadForm.tsx, src/app/g/[token]/ObservacionForm.tsx |
| App Movil Bajas — Desarmadero / 04D (3a) | src/app/fb/[token]/page.tsx, src/app/fb/[token]/UploadForm.tsx, src/lib/eventosBitacora.ts |
| Chrome / identidad (header, acento) | src/app/layout.tsx, src/app/globals.css, tailwind.config.ts |
