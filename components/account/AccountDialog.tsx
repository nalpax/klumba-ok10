'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { PostcardView } from '@/components/postcard/PostcardView';
import { Modal } from '@/components/ui/Modal';
import { ERROR_TEXT, getApi } from '@/lib/api';
import { CODE_ALPHABET, CODE_LENGTH, formatCode, isValidCodeShape, normalizeCode } from '@/lib/codes';
import { useAccount, type StudentSession, type TeacherSession } from './AccountProvider';

// Пока введённое ещё может стать 10-значным кодом — форматируем как код (заглавные буквы,
// дефис). Как только среди символов встречается что-то за пределами алфавита кодов
// (например, обычная буква кодового слова администратора) — оставляем ввод как есть.
const codeLikeRe = new RegExp(`^[${CODE_ALPHABET}]*$`);
function looksLikeCode(raw: string): boolean {
  return codeLikeRe.test(normalizeCode(raw));
}

function scrollTo(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id) ?? document.getElementById('garden');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function LoginForm() {
  const { login, closeDialog, openAdminPanel } = useAccount();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const demo = useMemo(() => getApi().demoCodes, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    if (looksLikeCode(trimmed) && !isValidCodeShape(normalizeCode(trimmed))) {
      setError(`Код состоит из ${CODE_LENGTH} знаков. Проверьте, что ввели всё до конца.`);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await login(trimmed);
    setBusy(false);
    if (!res.ok) {
      setError(ERROR_TEXT[res.error]);
      return;
    }
    // для администратора маленькое окно не нужно — сразу открываем панель
    if (res.role === 'admin') {
      closeDialog();
      openAdminPanel();
    }
  };

  return (
    <form className="login" onSubmit={submit} noValidate>
      <h2 className="dialog__title">Вход по коду</h2>
      <p className="dialog__lead">Введите код, который вам выдали в школе.</p>

      <label className="field">
        <span className="field__label">Ваш код</span>
        <input
          ref={inputRef}
          className="field__input field__input--code"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            setValue(looksLikeCode(raw) ? formatCode(normalizeCode(raw).slice(0, CODE_LENGTH)) : raw);
            setError(null);
          }}
          placeholder="XXXXX-XXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={CODE_LENGTH + 1}
          aria-invalid={error ? true : undefined}
          aria-describedby="login-hint login-error"
        />
      </label>

      <p className="field__hint" id="login-hint">
        Регистр не важен, дефис ставится сам. В кодах нет похожих знаков: нет нуля и буквы О, единицы и буквы I.
      </p>
      <p className="form-error" id="login-error" role="alert">
        {error}
      </p>

      <button type="submit" className="btn btn--lime btn--lg login__submit" disabled={busy}>
        {busy ? 'Проверяем…' : 'Войти'}
      </button>

      {demo ? (
        <div className="demo-codes">
          <p>Демо-режим. Нажмите на код, чтобы подставить его:</p>
          <div className="demo-codes__list">
            {demo.students.slice(0, 2).map((c) => (
              <button type="button" key={c} className="chip" onClick={() => { setValue(c); setError(null); }}>
                <span>Ученик</span> {c}
              </button>
            ))}
            {demo.teachers.slice(0, 2).map((t) => (
              <button type="button" key={t.code} className="chip" onClick={() => { setValue(t.code); setError(null); }}>
                <span>Учитель</span> {t.code}
              </button>
            ))}
            {demo.admin ? (
              <button type="button" className="chip" onClick={() => { setValue(demo.admin!); setError(null); }}>
                <span>Админ</span> {demo.admin}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  );
}

function StudentCabinet({ session }: { session: StudentSession }) {
  const { closeDialog, logout } = useAccount();
  const used = session.status === 'used';

  return (
    <div className="cabinet">
      <h2 className="dialog__title">{used ? 'Ваш цветок уже на клумбе 🌷' : 'Вы вошли'}</h2>
      <p className="dialog__code">{formatCode(session.code)}</p>
      <p className="dialog__lead">
        {used
          ? 'Ваш цветок уже растёт на нашей общей клумбе. Посадить второй нельзя: один код — один цветок.'
          : 'Можно посадить один цветок: выберите учителя, цветок, цвет и место на клумбе.'}
      </p>
      <div className="dialog__buttons">
        {used ? (
          <button
            type="button"
            className="btn btn--lime"
            onClick={() => {
              closeDialog();
              scrollTo('garden');
              window.dispatchEvent(new CustomEvent('garden:find', { detail: { plantingId: session.planting?.id ?? null } }));
            }}
          >
            Найти мой цветок
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--lime"
            onClick={() => {
              closeDialog();
              scrollTo('plant');
            }}
          >
            Посадить цветок
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Выйти
        </button>
      </div>
    </div>
  );
}

function TeacherCabinet({ session }: { session: TeacherSession }) {
  const { openCard, closeDialog, logout } = useAccount();
  return (
    <div className="cabinet cabinet--card">
      <PostcardView
        teacher={session.teacher}
        wish={session.wish}
        planted={session.planted}
        onOpen={openCard}
        onClose={closeDialog}
        onShowFlowers={() => {
          closeDialog();
          scrollTo('garden');
          window.dispatchEvent(new CustomEvent('garden:focus-teacher', { detail: { teacherId: session.teacher.id } }));
        }}
      />
      <button type="button" className="link-button" onClick={logout}>
        Выйти
      </button>
    </div>
  );
}

function AdminCabinet() {
  const { closeDialog, openAdminPanel, logout } = useAccount();
  return (
    <div className="cabinet">
      <h2 className="dialog__title">Вы вошли как администратор</h2>
      <p className="dialog__lead">Управление посадкой, учителями и кодами — в отдельной панели.</p>
      <div className="dialog__buttons">
        <button type="button" className="btn btn--lime" onClick={() => { closeDialog(); openAdminPanel(); }}>
          Открыть админ-панель
        </button>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Выйти
        </button>
      </div>
    </div>
  );
}

export function AccountDialog() {
  const { session, dialogOpen, closeDialog } = useAccount();
  const wide = session?.role === 'teacher';

  return (
    <Modal
      open={dialogOpen}
      onClose={closeDialog}
      label={session ? 'Личный кабинет' : 'Вход по коду'}
      className={wide ? 'modal--wide' : ''}
    >
      <button type="button" className="modal__close" onClick={closeDialog} aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      {!session ? (
        <LoginForm />
      ) : session.role === 'teacher' ? (
        <TeacherCabinet session={session} />
      ) : session.role === 'admin' ? (
        <AdminCabinet />
      ) : (
        <StudentCabinet session={session} />
      )}
    </Modal>
  );
}
