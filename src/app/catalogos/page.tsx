import Link from "next/link";

const CATALOGOS = [
  {
    href: "/catalogos/aseguradoras",
    title: "Aseguradoras",
    description: "Compañías de seguro que piden las bajas."
  },
  {
    href: "/catalogos/desarmaderos",
    title: "Desarmaderos",
    description: "Empresas que reciben el vehículo para desguace."
  },
  {
    href: "/catalogos/registros-automotores",
    title: "Registros automotores",
    description: "Oficinas donde se tramita la baja física."
  },
  {
    href: "/catalogos/tipos-baja",
    title: "Tipos de baja",
    description: "Catálogo abierto: 04D, 04C, 04 Digital, etc."
  },
  {
    href: "/catalogos/usuarios",
    title: "Usuarios",
    description: "Personas del equipo que pueden ser responsables de un caso."
  }
];

export default function CatalogosPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Catálogos</h1>
      <p className="text-sm text-slate-500 mb-6">
        Datos maestros que se usan al cargar y gestionar los casos.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATALOGOS.map((c) => (
          <Link key={c.href} href={c.href} className="card p-4 hover:border-brand-300">
            <h2 className="font-medium text-slate-800">{c.title}</h2>
            <p className="text-sm text-slate-500">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
