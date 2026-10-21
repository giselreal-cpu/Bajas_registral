import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Portada from "@/components/portada/Portada";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oltra Bajas — Gestión Integral Automotor",
  description:
    "Gestionamos trámites de baja por siniestro. Prioridad absoluta en el servicio a asegurados, productores y compañías de seguros."
};

// Portada pública: quien ya tiene sesión sigue yendo directo al panel.
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) redirect("/panel");

  return <Portada />;
}
