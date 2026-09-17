// src/lib/anexo04.ts
//
// Motor de generacion del Anexo 04 (Piezas RUDAC) para Next.js / Node.
// Dibuja las X directamente sobre el PDF oficial escaneado (preserva la
// marca de agua) usando pdf-lib. Puerto 1:1 del script Python ya validado.
//
// Server-only: importa pdf-lib. Los componentes "use client" que solo
// necesitan el catálogo de piezas deben importar piezasRudac.json
// directamente (no este archivo), para no arrastrar pdf-lib al bundle
// del navegador.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import piezasRudac from "./piezasRudac.json";

export type Categoria = "APC" | "C";

export interface PiezaRudac {
  codigo: string;
  descripcion: string;
  categoria: Categoria;
  requierePerito: boolean;
  page: number; // 0-6
  yPt: number; // posicion vertical de la fila, en puntos PDF (origen arriba)
}

export const PIEZAS_RUDAC = piezasRudac as PiezaRudac[];

export type Decision = "SI" | "NO";
export type Decisiones = Record<string, Decision>; // codigo -> SI | NO

const PAGE_HEIGHT_PT = 1800;
const SI_X_PT = (1749 + 1836) / 2 / 2;
const NO_X_PT = (1836 + 1950) / 2 / 2;
const DOMINIO_X_PT = 900 / 2;
const DOMINIO_Y_TOP_PT = 405 / 2;

/**
 * Genera el Anexo 04 completo.
 *
 * @param srcPdfBytes  Bytes del PDF original (anexo04_original.pdf),
 *                     leido una sola vez desde /public.
 * @param decisiones   Mapa codigo -> "SI" | "NO". Los codigos ausentes quedan
 *                     en blanco (sin marcar) en el PDF final.
 * @param dominio      Patente a escribir en el encabezado (opcional).
 */
export async function generarAnexo04(
  srcPdfBytes: Uint8Array | ArrayBuffer,
  decisiones: Decisiones,
  dominio?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(srcPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  if (dominio) {
    pages[0].drawText(dominio.toUpperCase(), {
      x: DOMINIO_X_PT,
      y: PAGE_HEIGHT_PT - DOMINIO_Y_TOP_PT,
      size: 13,
      font,
      color: rgb(0, 0, 0.55)
    });
  }

  for (const pieza of PIEZAS_RUDAC) {
    const deci = decisiones[pieza.codigo];
    if (deci !== "SI" && deci !== "NO") continue; // sin decision -> queda en blanco
    const page = pages[pieza.page];
    const xPt = deci === "SI" ? SI_X_PT : NO_X_PT;
    page.drawText("X", {
      x: xPt - 6,
      y: PAGE_HEIGHT_PT - pieza.yPt - 6,
      size: 15,
      font,
      color: rgb(0, 0, 0.6)
    });
  }

  return pdfDoc.save();
}

/**
 * Aplica las reglas por tipo de vehiculo + overrides puntuales del caso,
 * devolviendo el mapa de decisiones final para pasarle a generarAnexo04().
 *
 * reglas:    codigo -> { [tipoVehiculo]: "SI" | "NO" | "DEPENDE" }
 * overrides: codigo -> "SI" | "NO"  (decision manual para ESTE caso puntual,
 *            pisa lo que diga la regla general, incluido DEPENDE)
 */
export function resolverDecisiones(
  tipoVehiculo: string,
  reglas: Record<string, Record<string, "SI" | "NO" | "DEPENDE">>,
  overrides: Decisiones = {}
): Decisiones {
  const decisiones: Decisiones = {};
  for (const pieza of PIEZAS_RUDAC) {
    const regla = reglas[pieza.codigo]?.[tipoVehiculo];
    if (regla === "SI" || regla === "NO") decisiones[pieza.codigo] = regla;
  }
  return { ...decisiones, ...overrides };
}
