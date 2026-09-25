import type { CSSProperties } from 'react';
import { Leaf } from './Leaf';

/*
 * Осенние и праздничные украшения страницы. Всё — статичные SVG (рисуются один раз);
 * двигаются только флажки гирлянды — лёгким покачиванием через transform.
 * Все элементы декоративные: aria-hidden, не ловят клики.
 */

const RED = '#c8321f';
const ORANGE = '#ee8a2b';
const YELLOW = '#f2b33d';
const PLUM = '#7a2e6b';
const GREEN = '#4c8a17';

/* ------------------------------ гирлянда-флажки ------------------------------ */

const MAPLE =
  'M50 2 58 20 74 12 70 32 92 30 80 46 96 58 74 62 78 84 58 74 52 98H48L42 74 22 84 26 62 4 58 20 46 8 30 30 32 26 12 42 20Z';

const FLAG_COLORS = [RED, ORANGE, YELLOW, GREEN, PLUM];
// пробел — вместо флажка висит кленовый листик
const BUNTING_TEXT = ['С', ' ', 'Д', 'Н', 'Ё', 'М', ' ', 'У', 'Ч', 'И', 'Т', 'Е', 'Л', 'Я', '!'];

/** Праздничная гирлянда из флажков с надписью «С Днём учителя!» через весь первый экран. */
export function Bunting() {
  const W = 1200;
  const n = BUNTING_TEXT.length;
  const y0 = 8;
  const sag = 46;
  const point = (t: number) => ({ x: W * t, y: y0 + 4 * sag * t * (1 - t) });
  let colorIdx = 0;

  return (
    <svg className="bunting" viewBox={`0 0 ${W} 118`} preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
      <path d={`M0,${y0} Q${W / 2},${y0 + 2 * sag} ${W},${y0}`} fill="none" stroke="#8a6a3a" strokeWidth="2.2" />
      {BUNTING_TEXT.map((ch, i) => {
        const t = (i + 0.5) / n;
        const { x, y } = point(t);
        const slope = (Math.atan2(4 * sag * (1 - 2 * t), W) * 180) / Math.PI;
        const style = { '--d': `${(i % 5) * -0.7}s` } as CSSProperties;
        if (ch === ' ') {
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${slope})`}>
              <g className="bunting__flag" style={style}>
                <line x1="0" y1="0" x2="0" y2="10" stroke="#8a6a3a" strokeWidth="1.4" />
                <g transform="translate(-17,8) scale(0.34)">
                  <path d={MAPLE} fill={i < 5 ? ORANGE : RED} />
                </g>
              </g>
            </g>
          );
        }
        const color = FLAG_COLORS[colorIdx++ % FLAG_COLORS.length];
        const light = color === YELLOW;
        return (
          <g key={i} transform={`translate(${x},${y}) rotate(${slope})`}>
            <g className="bunting__flag" style={style}>
              <path d="M-30,0 L30,0 L0,70 Z" fill={color} />
              <path d="M-30,0 L30,0 L27,5 L-27,5 Z" fill="rgba(0,0,0,.14)" />
              <path d="M-22,4 L-4,4 L-12,26 Z" fill="rgba(255,255,255,.16)" />
              <text x="0" y="31" textAnchor="middle" className="bunting__letter" fill={light ? '#5a3a06' : '#fff8e8'}>
                {ch}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------ веточки ------------------------------ */

/** Ветка рябины: перистые листья и гроздь ягод. */
export function RowanSprig({ className, style }: { className?: string; style?: CSSProperties }) {
  const leaflets = (cx: number, cy: number, angle: number, color: string, len = 7) => (
    <g transform={`translate(${cx},${cy}) rotate(${angle})`}>
      <path d={`M0,0 L0,-${len * 11}`} stroke="#7a4a1c" strokeWidth="1.6" />
      {Array.from({ length: len }, (_, k) => {
        const yy = -8 - k * 10;
        const s = 1 - k * 0.05;
        return (
          <g key={k}>
            <ellipse cx={-9 * s} cy={yy} rx={9 * s} ry={3.6 * s} transform={`rotate(-28 ${-9 * s} ${yy})`} fill={color} />
            <ellipse cx={9 * s} cy={yy} rx={9 * s} ry={3.6 * s} transform={`rotate(28 ${9 * s} ${yy})`} fill={color} />
          </g>
        );
      })}
      <ellipse cx="0" cy={-len * 11 - 4} rx="3.6" ry="8" fill={color} />
    </g>
  );
  const berries: Array<[number, number, number]> = [
    [118, 118, 9], [132, 110, 8.5], [126, 128, 9], [142, 124, 8], [110, 132, 8.5], [136, 140, 8.5], [150, 112, 7.5],
    [120, 146, 8], [148, 138, 7.5], [104, 118, 7.5], [140, 98, 7], [156, 128, 7], [128, 96, 7],
  ];
  return (
    <svg className={className} style={style} viewBox="0 0 220 200" aria-hidden="true" focusable="false">
      <path d="M8,196 C40,160 70,130 120,112 C150,100 180,70 206,40" fill="none" stroke="#6b3f18" strokeWidth="5" strokeLinecap="round" />
      <path d="M120,112 C128,104 132,100 134,92" fill="none" stroke="#6b3f18" strokeWidth="2.4" />
      {leaflets(60, 150, -58, ORANGE, 6)}
      {leaflets(92, 128, -12, '#d9541e', 7)}
      {leaflets(170, 70, 52, YELLOW, 6)}
      {leaflets(186, 54, -8, ORANGE, 5)}
      {berries.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={i % 3 ? '#d7261e' : '#e84a1c'} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="rgba(255,255,255,.55)" />
          <circle cx={x + r * 0.2} cy={y + r * 0.55} r={r * 0.16} fill="#4a140c" />
        </g>
      ))}
    </svg>
  );
}

function OakLeaf({ x, y, angle, color, scale = 1 }: { x: number; y: number; angle: number; color: string; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle}) scale(${scale})`}>
      <path
        d="M0,0 C-6,-6 -14,-6 -12,-14 C-18,-18 -20,-26 -12,-28 C-18,-34 -16,-44 -8,-44 C-10,-52 -4,-60 0,-62 C4,-60 10,-52 8,-44 C16,-44 18,-34 12,-28 C20,-26 18,-18 12,-14 C14,-6 6,-6 0,0 Z"
        fill={color}
      />
      <path d="M0,0 L0,-58 M0,-16 L-9,-22 M0,-16 L9,-22 M0,-32 L-10,-38 M0,-32 L10,-38" stroke="rgba(0,0,0,.22)" strokeWidth="1.3" fill="none" />
    </g>
  );
}

function Acorn({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <ellipse cx="0" cy="10" rx="9" ry="12" fill="#c98a3a" />
      <ellipse cx="-3" cy="6" rx="2.6" ry="5" fill="rgba(255,255,255,.3)" />
      <path d="M-11,2 C-11,-8 11,-8 11,2 C6,5 -6,5 -11,2 Z" fill="#7a4a1c" />
      <path d="M-8,-1 L8,-1 M-9,2 L9,2 M-4,-5 L-6,3 M0,-6 L0,3 M4,-5 L6,3" stroke="rgba(0,0,0,.25)" strokeWidth="0.9" />
      <path d="M0,-6 C1,-10 3,-12 5,-13" stroke="#5a3410" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Дубовая ветка с желудями. */
export function OakSprig({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 220 200" aria-hidden="true" focusable="false">
      <path d="M212,196 C180,164 150,136 104,118 C74,106 44,80 16,46" fill="none" stroke="#6b3f18" strokeWidth="5" strokeLinecap="round" />
      <OakLeaf x={160} y={150} angle={48} color={ORANGE} scale={1.25} />
      <OakLeaf x={120} y={124} angle={-18} color="#b8651f" scale={1.3} />
      <OakLeaf x={60} y={84} angle={-62} color={YELLOW} scale={1.15} />
      <OakLeaf x={34} y={60} angle={4} color={RED} scale={1.05} />
      <Acorn x={96} y={128} angle={18} />
      <Acorn x={82} y={120} angle={-14} />
      <Acorn x={142} y={148} angle={30} />
    </svg>
  );
}

/* ------------------------------ гирлянда из листьев ------------------------------ */

const GARLAND_LEAVES: Array<[number, 'maple' | 'ovate', string, number]> = [
  [40, 'maple', RED, -20], [110, 'ovate', ORANGE, 30], [180, 'maple', YELLOW, 10], [250, 'ovate', PLUM, -30],
  [320, 'maple', ORANGE, 25], [390, 'ovate', RED, -10], [460, 'maple', GREEN, 15], [530, 'ovate', YELLOW, -25],
  [600, 'maple', RED, 5], [670, 'ovate', ORANGE, 35], [740, 'maple', PLUM, -15], [810, 'ovate', YELLOW, 20],
  [880, 'maple', ORANGE, -30], [950, 'ovate', RED, 10], [1020, 'maple', YELLOW, 25], [1090, 'ovate', GREEN, -20],
  [1160, 'maple', RED, 15],
];

/** Разделитель между разделами: волнистая лоза с осенними листьями и ягодами. */
export function LeafGarland({ className = '' }: { className?: string }) {
  const W = 1200;
  const y = (x: number) => 30 + 10 * Math.sin((x / W) * Math.PI * 6);
  let d = `M0,${y(0).toFixed(1)}`;
  for (let x = 20; x <= W; x += 20) d += ` L${x},${y(x).toFixed(1)}`;
  return (
    <div className={`garland ${className}`.trim()} aria-hidden="true">
      <svg className="garland__vine" viewBox={`0 0 ${W} 64`} preserveAspectRatio="none" focusable="false">
        <path d={d} fill="none" stroke="#7a5a2a" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {GARLAND_LEAVES.map(([x, shape, color, rot], i) => (
        <Leaf
          key={i}
          shape={shape}
          color={color}
          className={`garland__leaf garland__leaf--${shape}`}
          style={{ left: `${(x / W) * 100}%`, top: `${((y(x) - 6) / 64) * 100}%`, transform: `translate(-50%, -50%) rotate(${rot + (i % 2 ? 180 : 0)}deg)` }}
        />
      ))}
      {GARLAND_LEAVES.filter((_, i) => i % 3 === 1).map(([x], i) => (
        <span key={`b${i}`} className="garland__berries" style={{ left: `${((x + 35) / W) * 100}%`, top: `${(y(x + 35) / 64) * 100}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------ школьные рисунки ------------------------------ */

export function Apple({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 80 84" aria-hidden="true" focusable="false">
      <path d="M40,22 C24,10 4,18 6,42 C8,66 24,82 40,74 C56,82 72,66 74,42 C76,18 56,10 40,22 Z" fill="#d7261e" />
      <path d="M18,32 C14,40 14,50 18,58" stroke="rgba(255,255,255,.45)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M40,22 C40,14 42,8 46,4" stroke="#6b3f18" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M44,12 C52,2 66,4 68,8 C60,16 50,16 44,12 Z" fill={GREEN} />
    </svg>
  );
}

export function Pencil({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 160 36" aria-hidden="true" focusable="false">
      <rect x="22" y="6" width="112" height="24" fill={YELLOW} />
      <rect x="22" y="6" width="112" height="8" fill="#f7c95c" />
      <rect x="22" y="22" width="112" height="8" fill="#d99a24" />
      <rect x="134" y="6" width="10" height="24" fill="#b9b9b9" />
      <rect x="144" y="6" width="12" height="24" rx="5" fill="#f08aa0" />
      <path d="M22,6 L2,18 L22,30 Z" fill="#f3d3a4" />
      <path d="M8,14.5 L2,18 L8,21.5 Z" fill="#3c2c16" />
    </svg>
  );
}

export function Books({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      <rect x="8" y="64" width="104" height="22" rx="3" fill="#2f6fde" />
      <rect x="8" y="64" width="12" height="22" fill="rgba(0,0,0,.15)" />
      <rect x="26" y="72" width="60" height="4" rx="2" fill="rgba(255,255,255,.6)" />
      <rect x="16" y="42" width="92" height="22" rx="3" fill={GREEN} transform="rotate(-3 62 53)" />
      <rect x="30" y="49" width="50" height="4" rx="2" fill="rgba(255,255,255,.55)" transform="rotate(-3 62 53)" />
      <rect x="12" y="20" width="96" height="22" rx="3" fill={RED} transform="rotate(2 60 31)" />
      <rect x="28" y="28" width="56" height="4" rx="2" fill="rgba(255,255,255,.6)" transform="rotate(2 60 31)" />
      <path d="M86,6 C96,-2 110,4 104,16 C100,22 92,22 86,6 Z" fill={ORANGE} />
    </svg>
  );
}

export function Bell({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 90 100" aria-hidden="true" focusable="false">
      <path d="M45,4 C45,4 45,4 45,14" stroke="#7a4a1c" strokeWidth="4" strokeLinecap="round" />
      <path d="M45,14 C24,14 18,34 18,52 C18,64 12,72 6,78 L84,78 C78,72 72,64 72,52 C72,34 66,14 45,14 Z" fill="#f5b400" />
      <path d="M28,30 C24,40 24,52 24,62" stroke="rgba(255,255,255,.55)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="4" y="76" width="82" height="7" rx="3.5" fill="#d99a00" />
      <circle cx="45" cy="90" r="7" fill="#b37a00" />
      <path d="M60,6 C70,10 76,4 80,0" stroke={RED} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M58,8 C62,16 70,18 76,16" stroke={RED} strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
