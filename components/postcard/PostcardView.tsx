'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Leaf } from '@/components/site/Leaf';
import { ERROR_TEXT, type ApiError, type TeacherInfo } from '@/lib/api';
import { SCHOOL } from '@/lib/content';
import { addressName, fullName } from '@/lib/names';
import { plural } from '@/lib/plural';
import { BURST_LEAVES, DECOY_WISH, defaultWish } from '@/lib/postcard';

type Phase = 'closed' | 'lifting' | 'open';
type Outcome = { ok: true } | { ok: false; error: ApiError };

interface PostcardViewProps {
  teacher: TeacherInfo;
  /** null — открытка ещё не открыта, настоящего текста на странице нет */
  wish: string | null;
  planted: number;
  onOpen: () => Promise<Outcome>;
  onShowFlowers: () => void;
  onClose: () => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Открытка учителю. Пока она закрыта, пожелание размыто, а под размытием — текст-заглушка.
 * Кнопка «Открыть открытку» запрашивает настоящий текст; одновременно открытка выезжает из конверта.
 */
export function PostcardView({ teacher, wish, planted, onOpen, onShowFlowers, onClose }: PostcardViewProps) {
  const [phase, setPhase] = useState<Phase>(wish !== null ? 'open' : 'closed');
  const [burst, setBurst] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const open = async () => {
    setError(null);
    setPhase('lifting');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [res] = await Promise.all([onOpen(), wait(reduced ? 0 : 1200)]);
    if (!alive.current) return;
    if (!res.ok) {
      setPhase('closed');
      setError(ERROR_TEXT[res.error]);
      return;
    }
    setPhase('open');
    if (!reduced) {
      setBurst(true);
      setTimeout(() => alive.current && setBurst(false), 2800);
    }
  };

  const real = wish !== null ? wish.trim() || defaultWish(teacher) : null;
  const shown = phase === 'open' && real !== null ? real : null;
  const paragraphs = (shown ?? DECOY_WISH)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className={`postcard postcard--${phase}`}>
      <h2 className="postcard__heading">{phase === 'open' ? 'Ваша открытка' : 'Для вас пришла открытка'}</h2>
      <p className="postcard__to">{fullName(teacher)}</p>

      <div className="pc-stage">
      <div className="pc-scene">
        <div className="pc-back" aria-hidden="true" />
        <article className="pc-card">
          <h3 className="pc-card__title">{addressName(teacher)},</h3>
          <div className="pc-card__text" aria-hidden={shown === null}>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="pc-card__sign">С Днём учителя! 🌷</p>
          <p className="pc-card__from">Ученики {SCHOOL.complexGenitive}</p>
        </article>
        <div className="pc-front" aria-hidden="true" />
        <div className="pc-seal" aria-hidden="true">
          <img src={SCHOOL.emblem} alt="" width={64} height={64} />
        </div>

        {burst ? (
          <div className="pc-burst" aria-hidden="true">
            {BURST_LEAVES.map(([dx, dy, rot, color, shape, delay], i) => (
              <Leaf
                key={i}
                shape={shape}
                color={color}
                className="pc-burst__leaf"
                style={{ '--dx': `${dx}cqw`, '--dy': `${dy}cqw`, '--rot': `${rot}deg`, animationDelay: `${delay}s` } as CSSProperties}
              />
            ))}
          </div>
        ) : null}
      </div>
      </div>

      {phase === 'open' ? (
        <div className="postcard__after">
          <p role="status">
            Для вас уже посажено <strong>{planted}</strong> {plural(planted, ['цветок', 'цветка', 'цветов'])} 🌷
          </p>
          <div className="postcard__buttons">
            <button type="button" className="btn btn--lime" onClick={onShowFlowers}>
              Показать мои цветы
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      ) : (
        <div className="postcard__after">
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="postcard__hint">Пожелание для вас спрятано в конверте.</p>
          )}
          <button type="button" className="btn btn--lime btn--lg" onClick={open} disabled={phase === 'lifting'}>
            {phase === 'lifting' ? 'Открываем…' : 'Открыть открытку'}
          </button>
        </div>
      )}
    </div>
  );
}
