import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import RegistrarGastoForm from "./RegistrarGastoForm";

export const dynamic = "force-dynamic";

const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function RegistrarGastoPage() {
  const usuarioActual = await getUsuarioActual();
  if (usuarioActual?.rol === "compania") {
    return (
      <div className="mv max-w-md mx-auto text-center py-16">
        <h1 className="mv-heading text-lg mb-2">Sin acceso</h1>
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: casos }, { data: conceptos }, { data: cajas }] = await Promise.all([
    supabase
      .from("casos")
      .select("id, numero_siniestro, vehiculo:vehiculos(dominio), aseguradora:aseguradoras(nombre)")
      .neq("estado", "cerrado")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("conceptos_movimiento")
      .select("*, cuenta_contable:cuentas_contables(*)")
      .eq("tipo", "egreso")
      .order("nombre"),
    supabase.from("cajas").select("*").eq("activa", true).order("nombre")
  ]);

  let cajaPreseleccionadaId: string | null = null;
  if (usuarioActual) {
    const desde = new Date(Date.now() - TREINTA_DIAS_MS).toISOString();
    const { data: recientes } = await supabase
      .from("movimientos_caso")
      .select("caja_id")
      .eq("creado_por", usuarioActual.id)
      .not("caja_id", "is", null)
      .gte("created_at", desde);

    const conteos = new Map<string, number>();
    (recientes ?? []).forEach((r) => {
      if (r.caja_id) conteos.set(r.caja_id, (conteos.get(r.caja_id) ?? 0) + 1);
    });
    let max = 0;
    conteos.forEach((n, id) => {
      if (n > max) {
        max = n;
        cajaPreseleccionadaId = id;
      }
    });
  }
  if (!cajaPreseleccionadaId && cajas && cajas.length > 0) {
    cajaPreseleccionadaId = cajas[0].id;
  }

  return (
    <RegistrarGastoForm
      casos={(casos ?? []) as unknown as {
        id: string;
        numero_siniestro: string;
        vehiculo: { dominio: string } | null;
        aseguradora: { nombre: string } | null;
      }[]}
      conceptos={conceptos ?? []}
      cajas={cajas ?? []}
      cajaPreseleccionadaId={cajaPreseleccionadaId}
    />
  );
}
