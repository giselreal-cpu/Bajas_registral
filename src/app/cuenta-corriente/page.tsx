import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { Factura } from "@/types/database";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default async function CuentaCorrientePage() {
  const usuarioActual = await getUsuarioActual();

  if (usuarioActual?.rol === "compania") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Sin acceso</h1>
        <p className="text-sm text-slate-500">
          Esta sección es solo para el equipo de Oltra.
        </p>
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: facturas, error }, { data: aseguradoras }, { data: desarmaderos }] =
    await Promise.all([
      supabase.from("facturas").select("*, cobros(*)").order("fecha_emision", { ascending: false }),
      supabase.from("aseguradoras").select("id, nombre"),
      supabase.from("desarmaderos").select("id, nombre")
    ]);

  if (error) {
    return (
      <div className="card p-4 text-sm text-red-600">
        Error al cargar la cuenta corriente: {error.message}
      </div>
    );
  }

  const nombreDe = (tipo: string, id: string) => {
    const lista = tipo === "compania" ? aseguradoras : desarmaderos;
    return lista?.find((x) => x.id === id)?.nombre ?? "—";
  };

  interface Resumen {
    tipo: string;
    id: string;
    nombre: string;
    facturado: number;
    cobrado: number;
  }

  const resumenPorTercero = new Map<string, Resumen>();
  for (const f of (facturas as Factura[] | null) ?? []) {
    const clave = `${f.tipo_receptor}:${f.receptor_id}`;
    if (!resumenPorTercero.has(clave)) {
      resumenPorTercero.set(clave, {
        tipo: f.tipo_receptor,
        id: f.receptor_id,
        nombre: nombreDe(f.tipo_receptor, f.receptor_id),
        facturado: 0,
        cobrado: 0
      });
    }
    const entrada = resumenPorTercero.get(clave)!;
    entrada.facturado += Number(f.monto_total);
    entrada.cobrado += (f.cobros ?? []).reduce((acc, c) => acc + Number(c.monto), 0);
  }

  const terceros = Array.from(resumenPorTercero.values()).sort(
    (a, b) => b.facturado - b.cobrado - (a.facturado - a.cobrado)
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Cuenta corriente</h1>
      <p className="text-sm text-slate-500 mb-6">
        Saldo pendiente por compañía y desarmadero, sumando todos sus casos.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Tercero</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Facturado</th>
              <th className="px-4 py-2 font-medium">Cobrado</th>
              <th className="px-4 py-2 font-medium">Saldo pendiente</th>
            </tr>
          </thead>
          <tbody>
            {terceros.map((t) => (
              <tr key={`${t.tipo}:${t.id}`} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{t.nombre}</td>
                <td className="px-4 py-2">
                  {t.tipo === "compania" ? "Compañía" : "Desarmadero"}
                </td>
                <td className="px-4 py-2">{formatCurrency(t.facturado)}</td>
                <td className="px-4 py-2">{formatCurrency(t.cobrado)}</td>
                <td className="px-4 py-2 font-medium">
                  {formatCurrency(t.facturado - t.cobrado)}
                </td>
              </tr>
            ))}
            {terceros.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay facturas generadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
