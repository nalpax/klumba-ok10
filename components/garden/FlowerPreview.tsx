'use client';

import { useEffect, useRef } from 'react';
import { KIND_SPECS } from '@/lib/garden/flowers';
import { BOX_H, BOX_W, getSprite } from '@/lib/garden/sprites';
import type { FlowerKind } from '@/lib/garden/types';

interface Props {
  kind: FlowerKind;
  color: string;
  /** Высота превью в CSS-пикселях. */
  height?: number;
  label?: string;
}

/** Маленькое превью цветка тем же спрайтом, что рисуется на клумбе. */
export function FlowerPreview({ kind, color, height = 96, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = Math.round((height * BOX_W) / BOX_H);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(getSprite(kind, color, 0), 0, 0, canvas.width, canvas.height);
  }, [kind, color, height, width]);

  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      role="img"
      aria-label={label ?? KIND_SPECS[kind].label}
    />
  );
}
