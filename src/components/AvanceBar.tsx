interface Props {
  paso: number;
  total: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

// Barra de avance fina — mismo lenguaje visual que "Avance de la
// cartera por etapa" en el Panel. Solo lectura, no cambia nada del
// estado del caso.
export default function AvanceBar({ paso, total, size = "sm", showLabel = true }: Props) {
  const pct = total === 0 ? 0 : Math.round((paso / total) * 100);
  const alto = size === "sm" ? 6 : 8;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block rounded-full bg-silver-200 overflow-hidden"
        style={{ width: size === "sm" ? 64 : 100, height: alto }}
      >
        <span
          className="block rounded-full bg-accent-600"
          style={{ height: alto, width: `${Math.max(pct, paso > 0 ? 6 : 0)}%` }}
        />
      </span>
      {showLabel && (
        <span className="text-xs text-silver-500 tabular-nums whitespace-nowrap">
          {paso}/{total}
        </span>
      )}
    </span>
  );
}
