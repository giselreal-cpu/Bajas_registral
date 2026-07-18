import { redirect } from "next/navigation";
import CasoForm from "@/components/casos/CasoForm";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export default async function NuevoCasoPage() {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    redirect("/casos");
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Nuevo caso</h1>
      <p className="text-sm text-slate-500 mb-6">
        Cargá los datos del pedido de baja que llegó de la aseguradora.
      </p>
      <CasoForm />
    </div>
  );
}
