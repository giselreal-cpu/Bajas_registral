import AgendaList from "@/components/agenda/AgendaList";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export default async function AgendaPage() {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">
          Esta sección es de uso interno del equipo de Oltra.
        </p>
      </div>
    );
  }
  return <AgendaList />;
}
