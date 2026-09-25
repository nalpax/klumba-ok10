'use client';

import { useAccount } from '@/components/account/AccountProvider';

/** Кнопка и подсказка для учителей под шагами «Как это работает». */
export function HowLogin() {
  const { session, openDialog } = useAccount();
  return (
    <div className="how__cta">
      <button type="button" className="btn btn--lime btn--lg" onClick={openDialog}>
        {session ? 'Открыть кабинет' : 'Войти по коду'}
      </button>
      <p>Вы учитель? Войдите со своим кодом: для вас приготовлена открытка.</p>
    </div>
  );
}
