'use client';

import { useState } from 'react';
import { STUDENT_WISHES, pickRandom } from '@/lib/wishes';
import { Leaf } from './Leaf';

/**
 * Показывается вместо общего поздравления учителям, когда на сайт заходит ученик:
 * то же место, тот же вид письма, но текст — про новый учебный год, а не про учителей
 * (ученик их и так поздравляет цветком). Пожелание выбирается случайно при каждом заходе.
 */
export function StudentWish() {
  const [wish] = useState(() => pickRandom(STUDENT_WISHES));

  return (
    <section className="section" id="greeting" aria-labelledby="greeting-title">
      <div className="section__inner">
        <article className="letter">
          <Leaf shape="maple" color="#c8321f" className="letter__leaf letter__leaf--tl" />
          <Leaf shape="ovate" color="#ee8a2b" className="letter__leaf letter__leaf--tr" />
          <Leaf shape="ovate" color="#7a2e6b" className="letter__leaf letter__leaf--bl" />
          <Leaf shape="maple" color="#f2b33d" className="letter__leaf letter__leaf--br" />

          <h2 className="letter__title" id="greeting-title">
            {wish.title}
          </h2>
          <div className="letter__body">
            <p>{wish.body}</p>
          </div>
          <p className="letter__sign">Хорошего учебного года! 🌻</p>
          <p className="letter__extra">Твой цветок уже говорит «спасибо» за тебя — а это пожелание от нас, для тебя.</p>
        </article>
      </div>
    </section>
  );
}
