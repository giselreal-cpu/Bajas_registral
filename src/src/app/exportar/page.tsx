export default function ExportarPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Exportar datos</h1>
      <p className="text-sm text-slate-500 mb-6">
        Descargá la información cargada en el sistema para respaldo o para
        trabajarla en Excel.
      </p>

      <div className="space-y-4">
        <ExportCard
          titulo="Casos (CSV)"
          descripcion="Un renglón por caso, con aseguradora, asegurado, vehículo, desarmadero, registro, tipo de baja y responsable ya resueltos."
          href="/api/export/casos"
        />
        <ExportCard
          titulo="Bitácora (CSV)"
          descripcion="Todos los eventos de bitácora de todos los casos, con el número de siniestro correspondiente."
          href="/api/export/bitacora"
        />
        <ExportCard
          titulo="Documentos (CSV)"
          descripcion="Listado de documentos registrados (imágenes de dominio y documentación para la compañía) con su URL."
          href="/api/export/documentos"
        />
        <ExportCard
          titulo="Backup completo (JSON)"
          descripcion="Volcado completo de todas las tablas tal cual están en la base (incluyendo catálogos). Pensado como respaldo íntegro, no para abrir en Excel."
          href="/api/export/completo"
          destacado
        />
      </div>
    </div>
  );
}

function ExportCard({
  titulo,
  descripcion,
  href,
  destacado
}: {
  titulo: string;
  descripcion: string;
  href: string;
  destacado?: boolean;
}) {
  return (
    <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 className="font-medium text-slate-800">{titulo}</h2>
        <p className="text-sm text-slate-500">{descripcion}</p>
      </div>
      <a
        href={href}
        className={
          (destacado ? "btn-primary" : "btn-secondary") + " shrink-0 self-start sm:self-auto"
        }
      >
        Descargar
      </a>
    </div>
  );
}
