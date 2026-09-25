'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { Apple, RowanSprig } from './Decor';
import { Leaf } from './Leaf';

/**
 * Открытка на первом экране — объёмная: за ней стопка открыток, сверху скотч, листья и веточка рябины
 * «парят» на разной глубине. На компьютере открытка поворачивается вслед за мышкой и по ней бежит блик,
 * на телефоне — тихо покачивается сама. Всё через CSS 3D transform: перерисовки нет, работает на видеокарте.
 */
export function HeroCard() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return;

    const hero = stage.closest('.hero') ?? stage;
    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      stage.style.setProperty('--ry', `${(px * 9).toFixed(2)}deg`);
      stage.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`);
      stage.style.setProperty('--gx', `${(50 + px * 45).toFixed(1)}%`);
      stage.style.setProperty('--gy', `${(40 + py * 40).toFixed(1)}%`);
    };
    const onMove = (e: Event) => {
      const ev = e as PointerEvent;
      const r = stage.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / (r.width * 0.75)));
      py = Math.max(-1, Math.min(1, (ev.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
      stage.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      px = 0;
      py = 0;
      stage.classList.remove('is-tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-stage" ref={stageRef}>
      <div className="hero-3d">
        <div className="hero-paper hero-paper--kraft" aria-hidden="true" />
        <div className="hero-paper hero-paper--lined" aria-hidden="true" />
        <figure className="hero-card">
          <img src="hero/autumn-card.jpg" alt="" width={736} height={491} fetchPriority="high" />
          <span className="hero-card__glare" aria-hidden="true" />
        </figure>
        <span className="hero-tape hero-tape--left" aria-hidden="true" />
        <span className="hero-tape hero-tape--right" aria-hidden="true" />
        <Leaf shape="maple" color="#c8321f" className="hero-float hero-float--maple" style={{ '--z': '90px' } as CSSProperties} />
        <Leaf shape="ovate" color="#f2b33d" className="hero-float hero-float--ovate" style={{ '--z': '120px' } as CSSProperties} />
        <Leaf shape="maple" color="#ee8a2b" className="hero-float hero-float--maple2" style={{ '--z': '60px' } as CSSProperties} />
        <RowanSprig className="hero-float hero-float--sprig" style={{ '--z': '70px' } as CSSProperties} />
        <Apple className="hero-float hero-float--apple" style={{ '--z': '100px' } as CSSProperties} />
      </div>
    </div>
  );
}
