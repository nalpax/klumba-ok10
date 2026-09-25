import type { CSSProperties } from 'react';
import { Leaf, type LeafShape } from './Leaf';

// Детерминированный набор (без Math.random — иначе расхождение при гидратации).
const LEAVES: Array<{ left: number; size: number; dur: number; delay: number; sway: number; rot: number; color: string; shape: LeafShape }> = [
  { left: 4, size: 30, dur: 26, delay: -3, sway: 70, rot: 15, color: '#c8321f', shape: 'maple' },
  { left: 15, size: 18, dur: 31, delay: -19, sway: -60, rot: -40, color: '#f2b33d', shape: 'ovate' },
  { left: 27, size: 24, dur: 28, delay: -9, sway: 55, rot: 70, color: '#ee8a2b', shape: 'maple' },
  { left: 41, size: 16, dur: 34, delay: -25, sway: -80, rot: 20, color: '#7a2e6b', shape: 'ovate' },
  { left: 56, size: 26, dur: 29, delay: -14, sway: 65, rot: -60, color: '#f2b33d', shape: 'maple' },
  { left: 69, size: 18, dur: 33, delay: -5, sway: -50, rot: 45, color: '#c8321f', shape: 'ovate' },
  { left: 81, size: 28, dur: 27, delay: -21, sway: 75, rot: -20, color: '#ee8a2b', shape: 'maple' },
  { left: 93, size: 17, dur: 32, delay: -11, sway: -65, rot: 80, color: '#4c8a17', shape: 'ovate' },
];

/**
 * Листья, которые медленно падают по всей странице (за содержимым, поверх фона).
 * Только transform/opacity, на телефоне — вдвое меньше листьев.
 */
export function PageLeaves() {
  return (
    <div className="page-leaves" aria-hidden="true">
      {LEAVES.map((l, i) => (
        <Leaf
          key={i}
          shape={l.shape}
          color={l.color}
          className="leaf"
          style={
            {
              left: `${l.left}%`,
              width: l.size,
              height: l.shape === 'ovate' ? l.size * 1.66 : l.size,
              '--dur': `${l.dur}s`,
              '--delay': `${l.delay}s`,
              '--sway': `${l.sway}px`,
              '--rot': `${l.rot}deg`,
              '--y0': `${(i * 13) % 90}%`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
