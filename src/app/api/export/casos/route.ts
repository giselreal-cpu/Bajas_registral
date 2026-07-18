import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { ESTADOS, RAMAS } from "@/types/database";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("casos")
    .select(
      `
      numero_siniestro, estado, rama, tipo_tramite,
      fecha_ingreso, fecha_cierre, deuda_patentes, deuda_multas, observaciones,
      aseguradora:aseguradoras(nombre),
      asegurado:asegurados(nombre, dni, telefono, email),
      vehiculo:vehiculos(dominio, marca, modelo, anio),
      desarmadero:desarmaderos(nombre),
      registro:registros_automotores(numero),
      tipo_baja:tipos_baja(nombre),
      responsable:usuarios(nombre)
    `
    )
    .order("fecha_ingreso", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const filas = (data ?? []).map((c: any) => ({
    numero_siniestro: c.numero_siniestro,
    aseguradora: c.aseguradora?.nombre ?? "",
    asegurado: c.asegurado?.nombre ?? "",
    dni_asegurado: c.asegurado?.dni ?? "",
    telefono_asegurado: c.asegurado?.telefono ?? "",
    email_asegurado: c.asegurado?.email ?? "",
    dominio: c.vehiculo?.dominio ?? "",
    marca: c.vehiculo?.marca ?? "",
    modelo: c.vehiculo?.modelo ?? "",
    anio: c.vehiculo?.anio ?? "",
    desarmadero: c.desarmadero?.nombre ?? "",
    registro: c.registro?.numero ?? "",
    tipo_baja: c.tipo_baja?.nombre ?? "",
    responsable: c.responsable?.nombre ?? "",
    estado: ESTADOS.find((e) => e.value === c.estado)?.label ?? c.estado,
    rama: RAMAS.find((r) => r.value === c.rama)?.label ?? c.rama ?? "",
    tipo_tramite: c.tipo_tramite ?? "",
    fecha_ingreso: c.fecha_ingreso,
    fecha_cierre: c.fecha_cierre ?? "",
    deuda_patentes: c.deuda_patentes ?? 0,
    deuda_multas: c.deuda_multas ?? 0,
    observaciones: c.observaciones ?? ""
  }));

  const csv = toCsv(filas, [
    { key: "numero_siniestro", label: "N° Siniestro" },
    { key: "aseguradora", label: "Aseguradora" },
    { key: "asegurado", label: "Asegurado" },
    { key: "dni_asegurado", label: "DNI Asegurado" },
    { key: "telefono_asegurado", label: "Teléfono Asegurado" },
    { key: "email_asegurado", label: "Email Asegurado" },
    { key: "dominio", label: "Dominio" },
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "anio", label: "Año" },
    { key: "desarmadero", label: "Desarmadero" },
    { key: "registro", label: "Registro Automotor" },
    { key: "tipo_baja", label: "Tipo de Baja" },
    { key: "responsable", label: "Responsable" },
    { key: "estado", label: "Estado" },
    { key: "rama", label: "Rama" },
    { key: "tipo_tramite", label: "Tipo de Trámite" },
    { key: "fecha_ingreso", label: "Fecha Ingreso" },
    { key: "fecha_cierre", label: "Fecha Cierre" },
    { key: "deuda_patentes", label: "Deuda Patentes" },
    { key: "deuda_multas", label: "Deuda Multas" },
    { key: "observaciones", label: "Observaciones" }
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `casos_${fecha}.csv`);
}
