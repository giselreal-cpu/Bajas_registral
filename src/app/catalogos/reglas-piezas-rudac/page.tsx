import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import ReglasPiezasMatrix from "@/components/catalogos/ReglasPiezasMatrix";

export default async function ReglasPiezasRudacPage() {
  const usuarioActual = await getUsuarioActual();

  if (usuarioActual?.rol !== "administrador") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">Esta pantalla es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Reglas — Anexo 04 (Piezas RUDAC)</h1>
      <p className="text-sm text-slate-500 mb-6">
        Por cada pieza y tipo de vehículo: SI (se autoriza a desarmar), NO (no se autoriza), o "?"
        (depende del caso puntual — queda pendiente de revisar en el checklist de cada caso). Se
        guarda solo, celda por celda.
      </p>
      <ReglasPiezasMatrix />
    </div>
  );
}
