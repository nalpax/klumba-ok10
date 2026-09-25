'use client';

import { useEffect, useState, type Ref } from 'react';

/* ------------------------------ флаг, развевающийся на ветру ------------------------------ */

const BW = 420; // viewBox флага
const BH = 120;
const X0 = 34; // где начинается полотнище (левее — верёвки к самолёту)
const X1 = 410;
const HALF = 27; // половина высоты полотнища
const STEPS = 20;

/** Средняя линия полотнища: чем дальше от самолёта, тем сильнее волна. */
function midY(x: number, phase: number): number {
  const t = (x - X0) / (X1 - X0);
  const amp = 2 + 10 * t;
  return BH / 2 + amp * Math.sin((x / 150) * Math.PI * 2 - phase) - 2 * t;
}

function bannerPath(phase: number): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = X0 + ((X1 - X0) * i) / STEPS;
    const y = midY(x, phase);
    top.push(`${x.toFixed(1)},${(y - HALF).toFixed(1)}`);
    bottom.unshift(`${x.toFixed(1)},${(y + HALF).toFixed(1)}`);
  }
  return `M${top.join(' L')} L${bottom.join(' L')} Z`;
}

function midPath(phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = X0 + 10 + ((X1 - X0 - 20) * i) / STEPS;
    pts.push(`${x.toFixed(1)},${(midY(x, phase) + 6).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

/** Складка: тень-полоса на полотнище, изгибается вместе с волной. */
function foldPath(phase: number, x: number): string {
  const y = midY(x, phase);
  return `M${x.toFixed(1)},${(y - HALF).toFixed(1)} L${(x + 18).toFixed(1)},${(midY(x + 18, phase) - HALF).toFixed(1)} L${(x + 18).toFixed(1)},${(midY(x + 18, phase) + HALF).toFixed(1)} L${x.toFixed(1)},${(y + HALF).toFixed(1)} Z`;
}

const PHASES = [0, 1, 2, 3, 4].map((i) => (i * Math.PI) / 2);
const BANNER_FRAMES = PHASES.map(bannerPath).join(';');
const MID_FRAMES = PHASES.map(midPath).join(';');
const ROPE_TOP = PHASES.map((p) => `M4,46 L${X0},${(midY(X0, p) - HALF + 3).toFixed(1)}`).join(';');
const ROPE_BOTTOM = PHASES.map((p) => `M2,76 L${X0},${(midY(X0, p) + HALF - 3).toFixed(1)}`).join(';');
const WAVE_S = '1.5s';

function Banner({ animate }: { animate: boolean }) {
  const a = (values: string) =>
    animate ? <animate attributeName="d" dur={WAVE_S} repeatCount="indefinite" values={values} calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.25;0.5;0.75;1" /> : null;
  return (
    <svg className="gb-banner" viewBox={`0 0 ${BW} ${BH}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gb-banner-fill" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0%" stopColor="#fff7c2" />
          <stop offset="55%" stopColor="#fbef9a" />
          <stop offset="100%" stopColor="#f5e27a" />
        </linearGradient>
        <path id="gb-banner-mid" d={midPath(0)}>
          {a(MID_FRAMES)}
        </path>
      </defs>
      <path d={ROPE_TOP.split(';')[0]} stroke="#8a6a3a" strokeWidth="1.6" fill="none">
        {a(ROPE_TOP)}
      </path>
      <path d={ROPE_BOTTOM.split(';')[0]} stroke="#8a6a3a" strokeWidth="1.6" fill="none">
        {a(ROPE_BOTTOM)}
      </path>
      <path d={bannerPath(0)} fill="url(#gb-banner-fill)" stroke="#d6b24a" strokeWidth="2" strokeLinejoin="round">
        {a(BANNER_FRAMES)}
      </path>
      {[96, 212, 330].map((off) => (
        <path key={off} d={foldPath(0, off)} fill="rgba(170,130,20,0.12)">
          {a(PHASES.map((p) => foldPath(p, off)).join(';'))}
        </path>
      ))}
      <text className="gb-banner__text" fontSize="30" fontWeight="800" fill="#b3261e">
        <textPath href="#gb-banner-mid" startOffset="50%" textAnchor="middle">
          С Днём учителя!
        </textPath>
      </text>
    </svg>
  );
}

/* ------------------------------ бабочки над клумбой ------------------------------ */

const BUTTERFLIES: Array<[string, string]> = [
  ['#f08a24', '#7a2e0c'],
  ['#f5d547', '#8a6a0c'],
  ['#6cb4f5', '#1d4f8a'],
];

function Butterfly({ colors: [wing, edge] }: { colors: [string, string] }) {
  return (
    <svg className="bfly__svg" viewBox="-20 -16 40 32" focusable="false">
      <g className="bfly__wing bfly__wing--l">
        <path d="M-1,-1 C-8,-15 -19,-13 -17,-4 C-16,1 -8,2 -1,0 Z" fill={wing} stroke={edge} strokeWidth="1.2" />
        <path d="M-1,1 C-7,3 -14,6 -12,12 C-10,15 -4,10 -1,2 Z" fill={wing} stroke={edge} strokeWidth="1.2" />
        <circle cx="-11" cy="-6" r="2" fill="#fff" opacity="0.8" />
      </g>
      <g className="bfly__wing bfly__wing--r">
        <path d="M1,-1 C8,-15 19,-13 17,-4 C16,1 8,2 1,0 Z" fill={wing} stroke={edge} strokeWidth="1.2" />
        <path d="M1,1 C7,3 14,6 12,12 C10,15 4,10 1,2 Z" fill={wing} stroke={edge} strokeWidth="1.2" />
        <circle cx="11" cy="-6" r="2" fill="#fff" opacity="0.8" />
      </g>
      <ellipse cx="0" cy="1" rx="1.6" ry="8" fill="#2a1a0c" />
      <path d="M0,-6 C-2,-11 -4,-13 -6,-14 M0,-6 C2,-11 4,-13 6,-14" stroke="#2a1a0c" strokeWidth="0.9" fill="none" />
    </svg>
  );
}

/**
 * Самолёт с пилотом (картинка) тянет флаг. Летит справа налево — так смотрит сам самолёт.
 * Слой живёт в координатах мира клумбы: Garden двигает и масштабирует его вместе с камерой,
 * поэтому самолёт всегда в небе над газоном, а при приближении уходит из кадра вместе с небом.
 */
export function SkyPlane({ ref }: { ref?: Ref<HTMLDivElement> }) {
  // флаг «колышется» только если человек не просил поменьше анимаций
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAnimate(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div className="gb-flight" aria-hidden="true" ref={ref}>
      {BUTTERFLIES.map((b, i) => (
        <div key={i} className={`bfly bfly--${i + 1}`}>
          <Butterfly colors={b} />
        </div>
      ))}
      <div className="gb-plane">
        <div className="gb-plane__body">
          <img className="gb-plane__img" src="brand/plane.webp" alt="" width={284} height={202} decoding="async" loading="lazy" />
          <Banner animate={animate} />
        </div>
      </div>
    </div>
  );
}

/**
 * Декоративный фон клумбы: горы, солнце, речка у подножия и самолёт с флагом «С Днём учителя!».
 * Сам пейзаж — статичный SVG: он рисуется один раз и больше не перерисовывается. Всё, что движется
 * (самолёт, свечение солнца), — отдельные слои, которые браузер двигает на видеокарте (transform/opacity).
 * Рисуется позади canvas с цветами — видно в «небе» вокруг самой клумбы.
 */
export function GardenBackdrop() {
  return (
    <svg
      className="garden-backdrop"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="gb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe3ff" />
          <stop offset="32%" stopColor="#eaf3ff" />
          <stop offset="62%" stopColor="#ffe6b0" />
          <stop offset="100%" stopColor="#ffb75c" />
        </linearGradient>
        <radialGradient id="gb-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,250,234,0.9)" />
          <stop offset="45%" stopColor="rgba(255,216,115,0.55)" />
          <stop offset="100%" stopColor="rgba(245,180,0,0)" />
        </radialGradient>
        <radialGradient id="gb-sun-core" cx="42%" cy="36%" r="60%">
          <stop offset="0%" stopColor="#fffaea" />
          <stop offset="40%" stopColor="#ffd873" />
          <stop offset="100%" stopColor="#f5b400" />
        </radialGradient>
        <linearGradient id="gb-mtn-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b7c3e2" />
          <stop offset="100%" stopColor="#93a2c9" />
        </linearGradient>
        <linearGradient id="gb-mtn-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7285ae" />
          <stop offset="100%" stopColor="#526090" />
        </linearGradient>
        <linearGradient id="gb-mtn-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3e5672" />
          <stop offset="100%" stopColor="#263a52" />
        </linearGradient>
        <linearGradient id="gb-river" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#cdeeff" />
          <stop offset="100%" stopColor="#78b3da" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#gb-sky)" />

      <circle cx="1200" cy="200" r="230" fill="url(#gb-sun-glow)" opacity="0.8" />
      <circle cx="1200" cy="200" r="72" fill="url(#gb-sun-core)" />

      {/* дальние горы */}
      <path
        fill="url(#gb-mtn-back)"
        opacity="0.6"
        d="M-20,580 160,440 300,545 460,380 610,520 760,410 920,540 1080,400 1230,530 1390,420 1560,540 1620,470 1620,900 -20,900 Z"
      />
      {/* средние горы со снежными шапками */}
      <path
        fill="url(#gb-mtn-mid)"
        opacity="0.85"
        d="M-40,660 180,480 340,610 540,410 720,610 900,440 1080,615 1260,450 1440,615 1620,510 1620,900 -40,900 Z"
      />
      <path fill="#fbf8ee" opacity="0.95" d="M520,428 540,410 566,444 540,438 Z" />
      <path fill="#fbf8ee" opacity="0.95" d="M880,458 900,440 928,476 898,470 Z" />
      <path fill="#fbf8ee" opacity="0.95" d="M1240,468 1260,450 1288,486 1258,480 Z" />
      {/* ближние горы */}
      <path
        fill="url(#gb-mtn-front)"
        d="M-40,780 220,600 440,745 680,570 940,750 1180,610 1420,745 1620,650 1620,900 -40,900 Z"
      />

      {/* речка у подножия гор */}
      <path
        fill="url(#gb-river)"
        opacity="0.88"
        d="M-20,900 C 240,780 400,865 660,795 C 940,720 1160,830 1620,770 L1620,900 Z"
      />
      <path
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth="6"
        fill="none"
        d="M-20,862 C 260,758 420,825 660,772 C 940,706 1160,798 1620,748"
      />

    </svg>
  );
}
