/**
 * Декоративный фон клумбы: горы, солнце, речка у подножия и самолёт с флагом «С Днём учителя!».
 * Статичный SVG (никакой стоимости на кадр, кроме самолёта и мягкой пульсации солнца — обе
 * анимации только transform/opacity, дёшево даже на слабом телефоне). Рисуется позади canvas
 * с цветами — видно в «небе» вокруг самой клумбы.
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

      <circle className="gb-sun" cx="1200" cy="200" r="230" fill="url(#gb-sun-glow)" />
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

      <g className="gb-plane">
        <path d="M-96,0 L-150,0" stroke="#6b4a26" strokeWidth="2.5" opacity="0.65" strokeLinecap="round" />
        <path d="M-150,-19 L-350,-19 L-332,0 L-350,19 L-150,19 Z" fill="var(--autumn-red)" />
        <text
          x="-250"
          y="6.5"
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontWeight="700"
          fontSize="18"
          fill="#fff8e8"
        >
          С Днём учителя!
        </text>

        <path d="M-18,-7 L14,-40 L30,-40 L0,-5 Z" fill="#e6ddc4" stroke="#c9bd98" strokeWidth="1.5" />
        <path d="M-18,7 L14,40 L30,40 L0,5 Z" fill="#e6ddc4" stroke="#c9bd98" strokeWidth="1.5" />
        <path
          d="M-96,-15 C -68,-19 -18,-19 26,-9 C 50,-4 62,0 62,0 C 62,0 50,4 26,9 C -18,19 -68,19 -96,15 C -104,9 -104,-9 -96,-15 Z"
          fill="#fdfbf3"
          stroke="#c9bd98"
          strokeWidth="1.5"
        />
        <path d="M-80,-13 L-104,-30 L-92,-11 Z" fill="var(--autumn-red)" />
        <circle cx="54" cy="0" r="4" fill="#7fb0d8" stroke="#c9bd98" strokeWidth="1" />
      </g>
    </svg>
  );
}
