/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
    // Los Server Actions de /g/[token] y /fb/[token] (carga de documentos
    // por gestor y por Formulario de Baja) suben archivos de hasta 10MB
    // (ver TAMANIO_MAXIMO en src/lib/documentosStorage.ts) — el límite por
    // defecto de Next.js para Server Actions es 1MB, así que cualquier PDF
    // o foto de tamaño real se cortaba antes de llegar a esa validación.
    serverActions: {
      bodySizeLimit: "12mb"
    }
  }
};

export default nextConfig;
