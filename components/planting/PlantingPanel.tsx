'use client';

import { useMemo, useState } from 'react';
import { FlowerPreview } from '@/components/garden/FlowerPreview';
import { describeFlower } from '@/lib/garden/flowers';
import type { FlowerColor, FlowerType, Teacher } from '@/lib/garden/types';
import { fullName } from '@/lib/names';

export interface Choice {
  teacherId: number | null;
  flowerId: number | null;
  /** #RRGGBB из палитры */
  color: string;
}

interface PlantingPanelProps {
  teachers: Teacher[];
  flowers: FlowerType[];
  colors: FlowerColor[];
  choice: Choice;
  onChange: (next: Choice) => void;
  onNext: () => void;
  busy: boolean;
  notice: string | null;
}

function Avatar({ teacher }: { teacher: Teacher }) {
  if (teacher.photoUrl) {
    return <img className="avatar" src={teacher.photoUrl} alt="" width={44} height={44} loading="lazy" />;
  }
  const initials = `${teacher.lastName.charAt(0)}${teacher.firstName.charAt(0)}`.toUpperCase();
  return (
    <span className="avatar avatar--initials" style={{ boxShadow: `inset 0 0 0 2px ${teacher.color}` }} aria-hidden="true">
      {initials}
    </span>
  );
}

/** Шаги выбора: учитель → цветок → цвет. Место на клумбе выбирается следующим шагом прямо на клумбе. */
export function PlantingPanel({ teachers, flowers, colors, choice, onChange, onNext, busy, notice }: PlantingPanelProps) {
  const [query, setQuery] = useState('');

  const teacher = teachers.find((t) => t.id === choice.teacherId) ?? null;
  const allowed = useMemo(
    () =>
      teacher
        ? (teacher.flowerIds.map((id) => flowers.find((f) => f.id === id)).filter(Boolean) as FlowerType[])
        : [],
    [teacher, flowers],
  );
  const flower = flowers.find((f) => f.id === choice.flowerId) ?? null;
  const color = colors.find((c) => c.hex === choice.color) ?? colors[0] ?? null;
  const ready = Boolean(teacher && flower && color);

  const visibleTeachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => `${fullName(t)} ${t.subject}`.toLowerCase().includes(q));
  }, [teachers, query]);

  const pickTeacher = (t: Teacher) => {
    // если выбранный цветок для нового учителя недоступен — сбрасываем его
    const keep = choice.flowerId !== null && t.flowerIds.includes(choice.flowerId);
    onChange({ ...choice, teacherId: t.id, flowerId: keep ? choice.flowerId : null });
  };

  return (
    <section className="plant glass" id="plant" aria-labelledby="plant-title">
      <h3 className="plant__title" id="plant-title">
        Посадите свой цветок
      </h3>

      <div className="plant__grid">
        <div className="plant__steps">
          <fieldset className="plant__step">
            <legend>
              <span className="step-num">1</span> Выберите учителя
            </legend>
            {teachers.length > 6 ? (
              <input
                className="field__input plant__search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти учителя или предмет"
                aria-label="Найти учителя или предмет"
              />
            ) : null}
            <ul className="teacher-list">
              {visibleTeachers.map((t) => (
                <li key={t.id}>
                  <label className="teacher-opt">
                    <input type="radio" name="teacher" checked={choice.teacherId === t.id} onChange={() => pickTeacher(t)} />
                    <span className="teacher-opt__card">
                      <Avatar teacher={t} />
                      <span className="teacher-opt__text">
                        <strong>{fullName(t)}</strong>
                        <span>{t.subject}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
              {visibleTeachers.length === 0 ? <li className="plant__empty">Никого не нашли. Попробуйте другое слово.</li> : null}
            </ul>
          </fieldset>

          <fieldset className="plant__step">
            <legend>
              <span className="step-num">2</span> Выберите цветок
            </legend>
            {teacher ? (
              <div className="flower-list">
                {allowed.map((f) => (
                  <label className="flower-opt" key={f.id}>
                    <input
                      type="radio"
                      name="flower"
                      checked={choice.flowerId === f.id}
                      onChange={() => onChange({ ...choice, flowerId: f.id })}
                    />
                    <span className="flower-opt__card">
                      <FlowerPreview kind={f.kind} color={color?.hex ?? '#E03131'} height={92} label={f.name} />
                      <span>{f.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="plant__empty">Сначала выберите учителя.</p>
            )}
          </fieldset>

          <fieldset className="plant__step">
            <legend>
              <span className="step-num">3</span> Выберите цвет
              {color ? <span className="plant__color-name">{color.name}</span> : null}
            </legend>
            <div className="swatches">
              {colors.map((c) => (
                <label className="swatch" key={c.id}>
                  <input type="radio" name="color" checked={choice.color === c.hex} onChange={() => onChange({ ...choice, color: c.hex })} />
                  <span className="swatch__dot" style={{ background: c.hex }} title={c.name}>
                    <span className="sr-only">{c.name}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="plant__preview" aria-live="polite">
          <div className="plant__preview-art">
            {flower && color ? (
              <FlowerPreview kind={flower.kind} color={color.hex} height={230} label={`${flower.name}, ${color.name}`} />
            ) : (
              <p className="plant__empty">Здесь появится ваш цветок.</p>
            )}
          </div>
          <p className="plant__summary">
            {teacher && flower && color ? (
              <>
                <strong>{describeFlower(color.name, flower.kind, flower.name).replace(/^./, (c) => c.toUpperCase())}</strong>
                <span>для учителя: {fullName(teacher)}</span>
              </>
            ) : (
              <span>Выберите учителя и цветок.</span>
            )}
          </p>
          {notice ? (
            <p className="form-error" role="alert">
              {notice}
            </p>
          ) : null}
          <button type="button" className="btn btn--lime btn--lg" onClick={onNext} disabled={!ready || busy}>
            {busy ? 'Загружаем…' : 'Выбрать место на клумбе'}
          </button>
        </aside>
      </div>
    </section>
  );
}
