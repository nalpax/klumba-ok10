'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Garden, type GardenHandle } from '@/components/garden/Garden';
import { useGarden } from '@/components/garden/useGarden';
import { Bunting } from '@/components/site/Decor';
import { PageLeaves } from '@/components/site/PageLeaves';
import { SCHOOL } from '@/lib/content';
import { describeFlower } from '@/lib/garden/flowers';
import type { Planting } from '@/lib/garden/types';
import { fullName } from '@/lib/names';
import { totalCaption } from '@/lib/total';
import { defaultSiteUrl, qrSvg } from '@/lib/qr';

interface Toast {
  key: number;
  kind: 'flower' | 'info';
  title: string;
  text: string;
  color?: string;
}

const FOCUS_MS = 6500;
const INFO_EVERY_MS = 40_000;

/**
 * Режим для большого экрана (проектор в актовом зале, телевизор в холле): адрес сайта с ?screen.
 * Клумба во весь экран, крупный счётчик, QR-код «посади свой цветок», объявления о новых цветах.
 * Новый цветок камера показывает крупно и через несколько секунд возвращается ко всей клумбе.
 */
export function BigScreen() {
  const g = useGarden();
  const gardenRef = useRef<GardenHandle>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [qr, setQr] = useState<string>('');
  const [siteUrl, setSiteUrl] = useState('');
  const [chrome, setChrome] = useState(true);
  const seenMax = useRef<number | null>(null);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastKey = useRef(0);
  const lastFlowerAt = useRef(Date.now());

  const teacherById = useMemo(() => new Map(g.teachers.map((t) => [t.id, t])), [g.teachers]);
  const flowerById = useMemo(() => new Map(g.flowers.map((f) => [f.id, f])), [g.flowers]);
  const colorByHex = useMemo(() => new Map(g.colors.map((c) => [c.hex.toUpperCase(), c])), [g.colors]);
  const director = g.teachers.find((t) => t.isDirector) ?? null;

  const push = (t: Omit<Toast, 'key'>) => {
    const key = ++toastKey.current;
    setToasts((list) => [...list.slice(-2), { ...t, key }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.key !== key)), 11_000);
  };

  // QR-код сайта
  useEffect(() => {
    const url = defaultSiteUrl();
    setSiteUrl(url);
    qrSvg(url, 0)
      .then(setQr)
      .catch(() => setQr(''));
  }, []);

  // новые цветы: объявление + камера крупно показывает цветок
  useEffect(() => {
    if (!g.loaded) return;
    const max = g.plantings.reduce((m, p) => Math.max(m, p.id), 0);
    if (seenMax.current === null) {
      seenMax.current = max;
      return;
    }
    const fresh = g.plantings.filter((p) => p.id > (seenMax.current ?? 0));
    seenMax.current = Math.max(seenMax.current, max);
    if (fresh.length === 0) return;
    lastFlowerAt.current = Date.now();
    for (const p of fresh.slice(-3)) announce(p);
    const last = fresh[fresh.length - 1];
    gardenRef.current?.focusPlanting(last.id);
    if (backTimer.current) clearTimeout(backTimer.current);
    backTimer.current = setTimeout(() => gardenRef.current?.home(), FOCUS_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.plantings, g.loaded]);

  const announce = (p: Planting) => {
    const t = teacherById.get(p.teacherId);
    const f = flowerById.get(p.flowerId);
    const c = colorByHex.get(p.color.toUpperCase());
    const what = f ? (c ? describeFlower(c.name, f.kind, f.name) : f.name.toLowerCase()) : 'цветок';
    push({
      kind: 'flower',
      title: 'Новый цветок!',
      text: `${what.charAt(0).toUpperCase()}${what.slice(1)} — ${t ? (t.isDirector ? `для директора: ${fullName(t)}` : `для учителя: ${fullName(t)}`) : 'для учителя'}`,
      color: p.color,
    });
  };

  // когда долго тихо — напоминаем про подсолнух директора и про QR
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (Date.now() - lastFlowerAt.current < INFO_EVERY_MS / 2) return;
      n++;
      if (n % 2 === 1 && director) {
        gardenRef.current?.focusEmblem();
        if (backTimer.current) clearTimeout(backTimer.current);
        backTimer.current = setTimeout(() => gardenRef.current?.home(), FOCUS_MS);
        push({ kind: 'info', title: '🌻 Подсолнух в центре', text: `Главный цветок клумбы — директору школы, ${fullName(director)}` });
      } else {
        push({ kind: 'info', title: 'Посади свой цветок', text: 'Наведите камеру телефона на QR-код справа и введите свой код' });
      }
    }, INFO_EVERY_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director?.id]);

  // кнопки прячутся, если мышь не двигается
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setChrome(true);
      clearTimeout(t);
      t = setTimeout(() => setChrome(false), 3000);
    };
    wake();
    window.addEventListener('pointermove', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointermove', wake);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const count = g.plantings.length;
  const host = siteUrl.replace(/^https?:\/\//, '');

  return (
    <div className="screen" data-chrome={chrome ? 'on' : 'off'}>
      <PageLeaves />
      <div className="screen__bunting">
        <Bunting />
      </div>

      <header className="screen__head">
        <div className="screen__brand">
          <img src={SCHOOL.emblem} alt="" width={84} height={84} />
          <div>
            <h1 className="screen__title">С Днём учителя!</h1>
            <p className="screen__sub">Наша общая клумба · {SCHOOL.complex}</p>
          </div>
        </div>
        <div className="screen__count" aria-live="polite">
          <strong>{g.loaded ? count : '—'}</strong>
          <span>{totalCaption(count)} 🌷</span>
        </div>
      </header>

      <main className="screen__stage">
        <Garden
          ref={gardenRef}
          screen
          plantings={g.plantings}
          flowers={g.flowers}
          teachers={g.teachers}
          colors={g.colors}
          loaded={g.loaded}
        />

        <div className="screen__toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.key} className={`screen-toast screen-toast--${t.kind}`}>
              {t.color ? <i className="screen-toast__dot" style={{ background: t.color }} aria-hidden="true" /> : null}
              <div>
                <strong>{t.title}</strong>
                <span>{t.text}</span>
              </div>
            </div>
          ))}
        </div>

        {qr ? (
          <aside className="screen__qr">
            <div className="screen__qr-code" dangerouslySetInnerHTML={{ __html: qr }} />
            <p>
              <strong>Посади свой цветок!</strong>
              <span>{host}</span>
            </p>
          </aside>
        ) : null}
      </main>

      <div className="screen__tools">
        <button type="button" onClick={toggleFullscreen}>
          Во весь экран
        </button>
        <a href={siteUrl || './'}>Выйти из режима экрана</a>
      </div>
    </div>
  );
}
