'use client';

import { useAccount } from '@/components/account/AccountProvider';
import { SCHOOL } from '@/lib/content';

export function Header() {
  const { session, openDialog, openAdminPanel } = useAccount();
  const isAdmin = session?.role === 'admin';

  return (
    <header className="nav">
      <a className="nav__brand" href="#top" aria-label="Наверх">
        <img src={SCHOOL.emblem} alt="" width={36} height={36} />
        <span>ОК № 10</span>
      </a>
      <nav className="nav__links" aria-label="Разделы страницы">
        <a href="#greeting">Поздравление</a>
        <a href="#how">Как это работает</a>
        <a href="#garden">Клумба</a>
      </nav>
      <div className="nav__actions">
        <button type="button" className="btn btn--lime btn--sm" onClick={isAdmin ? openAdminPanel : openDialog}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {isAdmin ? (
              <path d="M4 13.5 9 4l1.8 3.4L12 5l1.2 2.4L15 4l5 9.5M4 13.5l1.4 6.5h13.2l1.4-6.5M4 13.5h16" />
            ) : (
              <>
                <circle cx="12" cy="8" r="3.6" />
                <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
              </>
            )}
          </svg>
          {session ? (isAdmin ? 'Админка' : 'Кабинет') : 'Вход'}
        </button>
      </div>
    </header>
  );
}
