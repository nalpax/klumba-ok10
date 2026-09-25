'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount } from '@/components/account/AccountProvider';
import { Garden, type GardenHandle } from '@/components/garden/Garden';
import { useGarden } from '@/components/garden/useGarden';
import { PlantingPanel, type Choice } from '@/components/planting/PlantingPanel';
import { ConfirmPlanting, PlaceBar, ThanksModal } from '@/components/planting/PlantingParts';
import { ERROR_TEXT, getApi } from '@/lib/api';
import { STATUS_TEXT, type ClosingContent } from '@/lib/content';
import { describeFlower } from '@/lib/garden/flowers';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import type { Planting, Slot, Teacher } from '@/lib/garden/types';
import { fullName, shortName } from '@/lib/names';
import { plural } from '@/lib/plural';

function Bar({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div className="bar glass" id={id}>
      {children}
    </div>
  );
}

/** Финальный экран для гостей, когда посадка завершена: заголовок и текст задаёт админ, статистика — по факту посадок. */
function ClosingPanel({ closing, plantings, teachers }: { closing: ClosingContent; plantings: Planting[]; teachers: Teacher[] }) {
  const stats = useMemo(() => {
    if (!closing.showStats || plantings.length === 0) return null;
    const byTeacher = new Map<number, number>();
    for (const p of plantings) byTeacher.set(p.teacherId, (byTeacher.get(p.teacherId) ?? 0) + 1);
    let top: { teacher: Teacher; count: number } | null = null;
    for (const [id, count] of byTeacher) {
      const t = teachers.find((x) => x.id === id);
      if (t && (!top || count > top.count)) top = { teacher: t, count };
    }
    return { total: plantings.length, reached: byTeacher.size, teachersTotal: teachers.length, top };
  }, [closing.showStats, plantings, teachers]);

  return (
    <Bar id="plant">
      <div className="closing">
        <p className="closing__title">{closing.title}</p>
        <p className="closing__text">{closing.text}</p>
        {stats ? (
          <ul className="closing__stats">
            <li>
              <strong>{stats.total}</strong>
              <span>{plural(stats.total, ['цветок', 'цветка', 'цветов'])} на клумбе</span>
            </li>
            <li>
              <strong>
                {stats.reached} из {stats.teachersTotal}
              </strong>
              <span>{plural(stats.teachersTotal, ['учителя', 'учителей', 'учителей'])} получили цветы</span>
            </li>
            {stats.top ? (
              <li>
                <strong>{fullName(stats.top.teacher)}</strong>
                <span>больше всех цветов — {stats.top.count}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </Bar>
  );
}

export function GardenSection() {
  const g = useGarden();
  const { session, applyPlanted, openDialog, openAdminPanel } = useAccount();
  const gardenRef = useRef<GardenHandle>(null);

  const [choice, setChoice] = useState<Choice>({ teacherId: null, flowerId: null, color: FLOWER_COLORS[0].hex });
  const [phase, setPhase] = useState<'choose' | 'place'>('choose');
  const [pool, setPool] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [focusTeacherId, setFocusTeacherId] = useState<number | null>(null);
  const [thanks, setThanks] = useState<{ planting: Planting; teacherName: string; phrase: string } | null>(null);

  // палитра может отличаться в базе: если выбранного цвета в ней нет, берём первый
  useEffect(() => {
    if (g.colors.length && !g.colors.some((c) => c.hex === choice.color)) {
      setChoice((c) => ({ ...c, color: g.colors[0].hex }));
    }
  }, [g.colors, choice.color]);

  const takenSlots = useMemo(() => new Set(g.plantings.map((p) => p.slotId)), [g.plantings]);
  const pickSlots = useMemo(() => (pool ? pool.filter((s) => !takenSlots.has(s.id)) : null), [pool, takenSlots]);

  // выбранное место заняли, пока человек думал
  useEffect(() => {
    if (slot && takenSlots.has(slot.id)) {
      setSlot(null);
      setNotice(ERROR_TEXT.slot_taken);
    }
  }, [slot, takenSlots]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of g.plantings) m.set(p.teacherId, (m.get(p.teacherId) ?? 0) + 1);
    return m;
  }, [g.plantings]);

  const teacher = g.teachers.find((t) => t.id === choice.teacherId) ?? null;
  const flower = g.flowers.find((f) => f.id === choice.flowerId) ?? null;
  const color = g.colors.find((c) => c.hex === choice.color) ?? null;
  const flowerPhrase =
    flower && color ? describeFlower(color.name, flower.kind, flower.name).replace(/^./, (c) => c.toUpperCase()) : '';

  // события из окна кабинета: «Найти мой цветок» и «Показать мои цветы»
  useEffect(() => {
    const onFind = (e: Event) => {
      const id = (e as CustomEvent<{ plantingId: number | null }>).detail?.plantingId;
      if (id == null) return;
      setFocusTeacherId(null);
      setTimeout(() => gardenRef.current?.focusPlanting(id), 500);
    };
    const onTeacher = (e: Event) => {
      const detail = (e as CustomEvent<{ teacherId: number; emblem?: boolean }>).detail;
      setFocusTeacherId(detail?.teacherId ?? null);
      setTimeout(() => (detail?.emblem ? gardenRef.current?.focusEmblem() : gardenRef.current?.fit()), 300);
    };
    window.addEventListener('garden:find', onFind);
    window.addEventListener('garden:focus-teacher', onTeacher);
    return () => {
      window.removeEventListener('garden:find', onFind);
      window.removeEventListener('garden:focus-teacher', onTeacher);
    };
  }, []);

  const scrollToStage = () =>
    document.getElementById('garden-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const loadSlots = async (): Promise<Slot[] | null> => {
    try {
      return await getApi().freeSlots();
    } catch {
      return null;
    }
  };

  const startPlacing = async () => {
    setNotice(null);
    setBusy(true);
    const slots = await loadSlots();
    setBusy(false);
    if (!slots) return setNotice(ERROR_TEXT.network);
    if (slots.length === 0) return setNotice(ERROR_TEXT.garden_full);
    setPool(slots);
    setSlot(null);
    setPhase('place');
    scrollToStage();
  };

  const backToChoose = () => {
    setPhase('choose');
    setPool(null);
    setSlot(null);
    setNotice(null);
  };

  const plant = async () => {
    if (!session || session.role !== 'student' || !slot || choice.teacherId == null || choice.flowerId == null) return;
    setBusy(true);
    setConfirmError(null);
    const res = await getApi()
      .plant({ code: session.code, teacherId: choice.teacherId, flowerId: choice.flowerId, color: choice.color, slotId: slot.id })
      .catch(() => null);
    setBusy(false);

    if (!res) return setConfirmError(ERROR_TEXT.network);
    if (!res.ok) {
      if (res.error === 'slot_taken') {
        setConfirmOpen(false);
        setSlot(null);
        setNotice(ERROR_TEXT.slot_taken);
        loadSlots().then((fresh) => fresh && setPool(fresh));
        return;
      }
      return setConfirmError(ERROR_TEXT[res.error]);
    }

    setConfirmOpen(false);
    g.addPlanting(res.planting);
    setHighlightId(res.planting.id);
    setPhase('choose');
    setPool(null);
    setSlot(null);
    setNotice(null);
    setTimeout(() => gardenRef.current?.focusPlanting(res.planting.id), 150);
    // благодарим через мгновение, когда цветок уже начал расти
    setTimeout(() => {
      setThanks({ planting: res.planting, teacherName: teacher ? fullName(teacher) : '', phrase: flowerPhrase });
    }, 900);
  };

  const closeThanks = () => {
    const p = thanks?.planting;
    setThanks(null);
    if (!p) return;
    // сессия ученика становится «цветок посажен» только сейчас: иначе панель выбора пропала бы раньше благодарности
    applyPlanted(p);
    scrollToStage();
    setTimeout(() => gardenRef.current?.focusPlanting(p.id), 300);
  };

  const toggleFocus = (id: number) => setFocusTeacherId((cur) => (cur === id ? null : id));

  /* -------- что показывать над клумбой -------- */
  let panel: ReactNode;
  if (g.status === 'closed' && !(session?.role === 'teacher') && !(session?.role === 'student' && session.status === 'used')) {
    panel = <ClosingPanel closing={g.closing} plantings={g.plantings} teachers={g.teachers} />;
  } else if (!session) {
    panel = (
      <Bar id="plant">
        <p>
          <strong>Хотите посадить свой цветок?</strong> Войдите по коду, который вам выдали в школе.
        </p>
        <button type="button" className="btn btn--lime" onClick={() => openDialog()}>
          Вход
        </button>
      </Bar>
    );
  } else if (session.role === 'teacher') {
    const mine = counts.get(session.teacher.id) ?? 0;
    const active = focusTeacherId === session.teacher.id;
    const isDirector = !!session.teacher.isDirector;
    panel = (
      <Bar id="plant">
        <p>
          <strong>{fullName(session.teacher)}</strong>,{' '}
          {isDirector ? 'подсолнух в центре клумбы — ваш, а ещё для вас посажено' : 'для вас посажено'} {mine}{' '}
          {plural(mine, ['цветок', 'цветка', 'цветов'])} {isDirector ? '🌻' : '🌷'}
        </p>
        <div className="bar__buttons">
          <button type="button" className="btn btn--lime btn--sm" onClick={() => openDialog()}>
            Открытка
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleFocus(session.teacher.id)}>
            {active ? 'Показать все цветы' : 'Показать мои цветы'}
          </button>
          {isDirector ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => gardenRef.current?.focusEmblem()}>
              Мой подсолнух
            </button>
          ) : null}
        </div>
      </Bar>
    );
  } else if (session.role === 'admin') {
    panel = (
      <Bar id="plant">
        <p>
          <strong>Вы вошли как администратор.</strong> Статус посадки: {STATUS_TEXT[g.status].toLowerCase()}.
        </p>
        <button type="button" className="btn btn--lime btn--sm" onClick={openAdminPanel}>
          Открыть админ-панель
        </button>
      </Bar>
    );
  } else if (session.status === 'used') {
    panel = (
      <Bar id="plant">
        <p>
          <strong>Ваш цветок уже растёт на нашей общей клумбе 🌷</strong>
        </p>
        <button type="button" className="btn btn--lime" onClick={() => gardenRef.current?.focusPlanting(session.planting?.id ?? -1)}>
          Найти мой цветок
        </button>
      </Bar>
    );
  } else {
    panel = (
      <PlantingPanel
        teachers={g.teachers}
        flowers={g.flowers}
        colors={g.colors}
        choice={choice}
        onChange={(c) => {
          setChoice(c);
          setNotice(null);
        }}
        onNext={startPlacing}
        busy={busy}
        notice={phase === 'choose' ? notice : null}
      />
    );
  }

  const overlay = (
    <>
      {phase === 'place' ? (
        <PlaceBar chosen={slot !== null} busy={busy} notice={notice} onPlant={() => { setConfirmError(null); setConfirmOpen(true); }} onBack={backToChoose} />
      ) : null}
      {focusTeacherId !== null ? (
        <div className="focus-chip">
          <span>
            Цветы для: {(() => { const t = g.teachers.find((x) => x.id === focusTeacherId); return t ? fullName(t) : ''; })()}
          </span>
          <button type="button" onClick={() => setFocusTeacherId(null)}>
            Показать все
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <section className="section" id="garden" aria-labelledby="garden-title">
      <div className="section__inner section__inner--wide">
        <header className="section__head">
          <h2 className="section__title" id="garden-title">
            Клумба, которую мы растим <em>вместе</em>
          </h2>
          <p className="section__lead">
            Каждый цветок — один ученик, который сказал спасибо своему учителю. Чем больше цветов, тем гуще клумба.
          </p>
        </header>

        <div className="garden__panel">{panel}</div>

        <Garden
          ref={gardenRef}
          plantings={g.plantings}
          flowers={g.flowers}
          teachers={g.teachers}
          colors={g.colors}
          loaded={g.loaded}
          highlightId={highlightId}
          pickSlots={pickSlots}
          chosen={slot && flower ? { slot, kind: flower.kind, color: choice.color } : null}
          onPickSlot={(s) => {
            setSlot(s);
            setNotice(null);
          }}
          focusTeacherId={focusTeacherId}
          overlay={overlay}
        />

        <ul className="legend" aria-label="Для каких учителей посажены цветы">
          {g.teachers.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="legend__item"
                aria-pressed={focusTeacherId === t.id}
                onClick={() => toggleFocus(t.id)}
                title="Показать цветы этого учителя"
              >
                <span className="legend__dot" style={{ background: t.color }} aria-hidden="true" />
                <span className="legend__text">
                  <span>{t.subject}</span>
                  <small>{shortName(t)}</small>
                </span>
                <b>{counts.get(t.id) ?? 0}</b>
              </button>
            </li>
          ))}
        </ul>

        {g.demo ? (
          <div className="demo-bar">
            <p>Сейчас показаны демонстрационные данные. Коды для проверки — в окне «Вход».</p>
          </div>
        ) : null}
      </div>

      <ThanksModal
        open={thanks !== null}
        teacherName={thanks?.teacherName ?? ''}
        flowerPhrase={thanks?.phrase ?? ''}
        kind={thanks ? (g.flowers.find((f) => f.id === thanks.planting.flowerId)?.kind ?? null) : null}
        color={thanks?.planting.color ?? '#E03131'}
        onClose={closeThanks}
      />

      <ConfirmPlanting
        open={confirmOpen}
        teacherName={teacher ? fullName(teacher) : ''}
        subject={teacher?.subject ?? ''}
        flowerPhrase={flowerPhrase}
        busy={busy}
        error={confirmError}
        onConfirm={plant}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
