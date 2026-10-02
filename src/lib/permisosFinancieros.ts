import { RolUsuario } from "@/types/database";

export const CONCEPTO_GESTORIA = "Honorarios por Gestoría";

// Aprobar un gasto o marcarlo pagado mueve plata real, así que por
// defecto es solo de administrador. Excepción: operador puede hacerlo
// con los pagos de gestoría (concepto "Honorarios por Gestoría").
export function puedeAprobarMovimiento(rol: RolUsuario | undefined | null, conceptoNombre: string | null | undefined): boolean {
  if (rol === "administrador") return true;
  return rol === "operador" && conceptoNombre === CONCEPTO_GESTORIA;
}
