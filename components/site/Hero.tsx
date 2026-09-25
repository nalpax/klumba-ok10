import type { CSSProperties } from 'react';
import { STATUS_TEXT, type EventStatus } from '@/lib/content';
import { Leaf, type LeafShape } from './Leaf';
import { SchoolBadge } from './SchoolBadge';

interface LeafSpec {
  left: number;
  y0: number;
  size: number;
  dur: number;
  delay: number;
  sway: number;
  rot: number;
  color: string;
  shape: LeafShape;
}

// Детерминированный набор (без Math.random — иначе расхождение при гидратации).
const LEAVES: LeafSpec[] = [
  { left: 6, y0: 18, size: 44, dur: 19, delay: -4, sway: 60, rot: 20, color: '#c8321f', shape: 'maple' },
  { left: 17, y0: 62, size: 26, dur: 23, delay: -13, sway: -50, rot: -30, color: '#ee8a2b', shape: 'ovate' },
  { left: 29, y0: 34, size: 34, dur: 21, delay: -9, sway: 40, rot: 60, color: '#f2b33d', shape: 'ovate' },
  { left: 44, y0: 8, size: 22, dur: 26, delay: -18, sway: -70, rot: 10, color: '#7a2e6b', shape: 'ovate' },
  { left: 58, y0: 70, size: 40, dur: 20, delay: -2, sway: 55, rot: -50, color: '#c8321f', shape: 'maple' },
  { left: 71, y0: 28, size: 28, dur: 24, delay: -15, sway: -45, rot: 35, color: '#ee8a2b', shape: 'ovate' },
  { left: 83, y0: 54, size: 36, dur: 22, delay: -7, sway: 65, rot: -15, color: '#f2b33d', shape: 'maple' },
  { left: 92, y0: 12, size: 24, dur: 27, delay: -20, sway: -55, rot: 75, color: '#7a2e6b', shape: 'ovate' },
  { left: 37, y0: 80, size: 30, dur: 25, delay: -11, sway: 50, rot: -70, color: '#ee8a2b', shape: 'maple' },
];

export function Hero({ status = 'open' }: { status?: EventStatus }) {
  return (
    <section className="hero" id="top">
      <div className="hero__sun" aria-hidden="true">
        <span className="hero__sun-rays" />
        <span className="hero__sun-core" />
      </div>
      <div className="hero__moss" aria-hidden="true" />
      <div className="hero__leaves" aria-hidden="true">
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
                '--y0': `${l.y0}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="hero__inner">
        <p className="status-pill" data-status={status}>
          <span className="status-pill__dot" aria-hidden="true" />
          {STATUS_TEXT[status]}
        </p>

        <h1 className="sr-only">С Днём учителя!</h1>
        <figure className="hero-card">
          <img
            src="/hero/autumn-card.jpg"
            alt=""
            width={736}
            height={491}
            fetchPriority="high"
          />
        </figure>

        <p className="hero__lead">Спасибо за знания, вдохновение и доброту</p>
        <a className="btn btn--lime btn--lg" href="#greeting">
          Открыть поздравление ↓
        </a>
      </div>

      <div className="hero__school">
        <SchoolBadge />
      </div>
    </section>
  );
}
