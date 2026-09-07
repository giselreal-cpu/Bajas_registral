import { Estado, ESTADOS } from "@/types/database";

// Reusa el mismo orden de estados que ya maneja
// src/lib/estadoAutomatico.ts (ORDEN_ESTADOS) — acá solo se necesita la
// posición para mostrar un indicador de avance, no recalcular nada.
export function avanceCaso(estado: Estado): { paso: number; total: number; pct: number } {
  const total = ESTADOS.length;
  const indice = ESTADOS.findIndex((e) => e.value === estado);
  const paso = indice === -1 ? 0 : indice + 1;
  return { paso, total, pct: Math.round((paso / total) * 100) };
}
