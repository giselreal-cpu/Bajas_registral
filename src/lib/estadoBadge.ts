export function estadoBadgeClass(estado: string): string {
  switch (estado) {
    case "cerrado":
      return "bg-emerald-100 text-emerald-700";
    case "baja_en_tramite":
      return "bg-brand-100 text-brand-700";
    case "iniciado":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}
