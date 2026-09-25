import type { CSSProperties } from 'react';

export type LeafShape = 'maple' | 'ovate';

interface LeafProps {
  shape: LeafShape;
  color: string;
  className?: string;
  style?: CSSProperties;
}

/** Осенний лист. Форма и цвет задаются пропсами; только декор (aria-hidden). */
export function Leaf({ shape, color, className, style }: LeafProps) {
  if (shape === 'maple') {
    return (
      <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path
          d="M50 2 58 20 74 12 70 32 92 30 80 46 96 58 74 62 78 84 58 74 52 98H48L42 74 22 84 26 62 4 58 20 46 8 30 30 32 26 12 42 20Z"
          fill={color}
        />
        <path
          d="M50 96V30M50 70 26 60M50 70 74 60M50 52 22 36M50 52 78 36"
          fill="none"
          stroke="rgba(0,0,0,.22)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={className} style={style} viewBox="0 0 48 80" aria-hidden="true" focusable="false">
      <path d="M24 2C42 20 42 56 24 78 6 56 6 20 24 2Z" fill={color} />
      <path
        d="M24 10V78M24 30l10-8M24 46l12-10M24 30 14 22M24 46 12 36M24 60l8-6M24 60l-8-6"
        fill="none"
        stroke="rgba(0,0,0,.24)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
