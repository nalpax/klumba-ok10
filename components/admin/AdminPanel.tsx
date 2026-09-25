'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/components/account/AccountProvider';
import { FlowerPreview } from '@/components/garden/FlowerPreview';
import { useEventStatus } from '@/components/garden/useGarden';
import { Modal } from '@/components/ui/Modal';
import { ERROR_TEXT, getApi, type AdminResult, type AdminStats, type TeacherInput } from '@/lib/api';
import { formatCode } from '@/lib/codes';
import { DEFAULT_CLOSING, STATUS_TEXT, type ClosingContent, type EventStatus } from '@/lib/content';
import { ALL_FLOWER_IDS } from '@/lib/garden/catalog';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { codeLink, defaultSiteUrl, printCodeCards, printPoster, qrPng } from '@/lib/qr';
import type { FlowerType } from '@/lib/garden/types';
import { fullName } from '@/lib/names';
import { plural } from '@/lib/plural';

type Tab = 'event' | 'teachers' | 'codes' | 'qr';

// новому учителю по умолчанию доступны все цветы — ученикам есть из чего выбрать
const EMPTY_TEACHER: TeacherInput = {
  firstName: '', middleName: '', lastName: '', subject: '', color: FLOWER_COLORS[0].hex, flowerIds: [...ALL_FLOWER_IDS], wish: '',
};

/** Окно для печати открываем сразу по нажатию (иначе браузер его заблокирует), а заполняем, когда готовы QR. */
function openPrintWindow(): Window | null {
  const win = window.open('', '_blank');
  if (win) win.document.write('<p style="font:16px sans-serif;padding:20px">Готовим QR-коды…</p>');
  return win;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
const ACCENT_SWATCHES = FLOWER_COLORS.slice(0, 10);

/** Панель администратора: статус посадки, учителя, коды. Открывается поверх сайта отдельным окном. */
export function AdminPanel() {
  const { session, adminPanelOpen, closeAdminPanel, logout } = useAccount();
  const status = useEventStatus();
  const [tab, setTab] = useState<Tab>('event');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [flowers, setFlowers] = useState<FlowerType[]>([]);
  const [teachers, setTeachers] = useState<TeacherInput[] | null>(null);
  const [closing, setClosing] = useState<ClosingContent>(DEFAULT_CLOSING);
  const [statusBusy, setStatusBusy] = useState(false);

  const refreshStats = useCallback(() => {
    getApi()
      .adminStats()
      .then(setStats)
      .catch((e: Error) => {
        // ключ сессии устарел (например, сменили пароль) — выходим, чтобы можно было войти заново
        if (e.message === 'unauthorized') logout();
      });
  }, [logout]);
  const refreshTeachers = useCallback(() => {
    getApi()
      .adminListTeachers()
      .then(setTeachers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!adminPanelOpen || session?.role !== 'admin') return;
    refreshStats();
    refreshTeachers();
    getApi()
      .load()
      .then((snap) => {
        setFlowers(snap.flowers);
        setClosing(snap.closing);
      })
      .catch(() => {});
  }, [adminPanelOpen, session, refreshStats, refreshTeachers]);

  if (session?.role !== 'admin') return null;

  const setStatus = async (next: EventStatus) => {
    setStatusBusy(true);
    await getApi().adminSetStatus(next);
    refreshStats();
    setStatusBusy(false);
  };

  return (
    <Modal open={adminPanelOpen} onClose={closeAdminPanel} label="Админ-панель" className="modal--admin">
      <button type="button" className="modal__close" onClick={closeAdminPanel} aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <div className="admin-head">
        <h2 className="dialog__title">Админ-панель</h2>
        <button type="button" className="admin-logout" onClick={logout}>
          Выйти из панели
        </button>
      </div>

      {stats ? (
        <div className="admin-stats" aria-label="Сводка">
          <div>
            <strong>{stats.plantings}</strong>
            <span>цветов на клумбе</span>
          </div>
          <div>
            <strong>{stats.studentCodesUsed} / {stats.studentCodesTotal}</strong>
            <span>кодов учеников использовано</span>
          </div>
          <div>
            <strong>{stats.slotsFree}</strong>
            <span>мест ещё свободно</span>
          </div>
          <div>
            <strong>{stats.teacherCodesTotal}</strong>
            <span>кодов учителей выдано</span>
          </div>
        </div>
      ) : null}

      <div className="admin-tabs" role="tablist" aria-label="Разделы админ-панели">
        <button type="button" role="tab" aria-selected={tab === 'event'} onClick={() => setTab('event')}>
          Мероприятие
        </button>
        <button type="button" role="tab" aria-selected={tab === 'teachers'} onClick={() => setTab('teachers')}>
          Учителя
        </button>
        <button type="button" role="tab" aria-selected={tab === 'codes'} onClick={() => setTab('codes')}>
          Коды ученикам
        </button>
        <button type="button" role="tab" aria-selected={tab === 'qr'} onClick={() => setTab('qr')}>
          QR-код сайта
        </button>
      </div>

      {tab === 'event' && stats ? (
        <EventTab
          status={status}
          stats={stats}
          busy={statusBusy}
          onSetStatus={setStatus}
          closing={closing}
          onSaveClosing={async (next) => {
            const res = await getApi().adminSetClosing(next);
            if (res.ok) setClosing(next);
            return res;
          }}
        />
      ) : null}
      {tab === 'teachers' ? (
        <TeachersTab
          teachers={teachers}
          flowers={flowers}
          byTeacher={stats?.byTeacher ?? {}}
          onChanged={() => {
            refreshTeachers();
            refreshStats();
          }}
        />
      ) : null}
      {tab === 'codes' && stats ? <CodesTab stats={stats} onGenerated={refreshStats} /> : null}
      {tab === 'qr' ? <QrTab /> : null}
    </Modal>
  );
}

function EventTab({
  status,
  stats,
  busy,
  onSetStatus,
  closing,
  onSaveClosing,
}: {
  status: EventStatus;
  stats: AdminStats;
  busy: boolean;
  onSetStatus: (s: EventStatus) => void;
  closing: ClosingContent;
  onSaveClosing: (next: ClosingContent) => Promise<AdminResult>;
}) {
  const OPTIONS: { value: EventStatus; label: string; hint: string }[] = [
    { value: 'draft', label: 'Черновик', hint: 'Сайт виден, но вход по коду и посадка ещё закрыты.' },
    { value: 'open', label: 'Идёт посадка', hint: 'Ученики входят по коду и сажают цветы на клумбу.' },
    { value: 'closed', label: 'Завершено', hint: 'Посадка остановлена. Клумбу видно, новые цветы посадить нельзя.' },
  ];

  const [form, setForm] = useState<ClosingContent>(closing);
  const [closingBusy, setClosingBusy] = useState(false);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [closingSaved, setClosingSaved] = useState(false);
  const dirty = form.title !== closing.title || form.text !== closing.text || form.showStats !== closing.showStats;

  // если пришло обновление извне (например, тот же админ открыл панель на другом экране) — подхватываем, пока форма не тронута
  useEffect(() => {
    if (!dirty) setForm(closing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  const saveClosing = async () => {
    setClosingBusy(true);
    setClosingError(null);
    setClosingSaved(false);
    const res = await onSaveClosing(form);
    setClosingBusy(false);
    if (!res.ok) {
      setClosingError(ERROR_TEXT[res.error]);
      return;
    }
    setClosingSaved(true);
  };

  return (
    <div className="admin-tab">
      <p className="admin-tab__lead">
        Открыть или остановить посадку можно в любой момент — изменение видно всем прямо сейчас, без перезагрузки страницы.
      </p>
      <div className="admin-status" role="group" aria-label="Статус посадки">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className="admin-status__opt"
            aria-pressed={status === o.value}
            disabled={busy}
            onClick={() => onSetStatus(o.value)}
          >
            <strong>{o.label}</strong>
            <span>{o.hint}</span>
          </button>
        ))}
      </div>
      {stats.teachersWithoutWish > 0 ? (
        <p className="notice notice--plain">
          <span className="notice__mark" aria-hidden="true">!</span>
          {stats.teachersWithoutWish} {plural(stats.teachersWithoutWish, ['учитель', 'учителя', 'учителей'])} без личного пожелания —
          {' '}им откроется запасной текст открытки. Можно дописать в разделе «Учителя».
        </p>
      ) : null}

      <div className="admin-closing">
        <h3 className="admin-tab__title admin-closing__title">Когда посадка завершится</h3>
        <p className="admin-tab__lead">Это увидят гости на сайте, когда вы переключите статус на «Завершено».</p>

        <label className="field">
          <span className="field__label">Заголовок</span>
          <input
            className="field__input"
            value={form.title}
            onChange={(e) => {
              setForm({ ...form, title: e.target.value });
              setClosingSaved(false);
            }}
          />
        </label>
        <label className="field">
          <span className="field__label">Текст</span>
          <textarea
            className="field__input admin-textarea"
            rows={3}
            value={form.text}
            onChange={(e) => {
              setForm({ ...form, text: e.target.value });
              setClosingSaved(false);
            }}
          />
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={form.showStats}
            onChange={(e) => {
              setForm({ ...form, showStats: e.target.checked });
              setClosingSaved(false);
            }}
          />
          <span>Показать итоги: сколько цветов посажено и для скольких учителей</span>
        </label>

        {closingError ? (
          <p className="form-error" role="alert">
            {closingError}
          </p>
        ) : null}
        <div className="dialog__buttons admin-closing__buttons">
          <button type="button" className="btn btn--lime btn--sm" onClick={saveClosing} disabled={closingBusy || !dirty}>
            {closingBusy ? 'Сохраняем…' : 'Сохранить'}
          </button>
          {closingSaved && !dirty ? <span className="admin-closing__ok">Сохранено ✓</span> : null}
        </div>
      </div>
    </div>
  );
}

function TeachersTab({
  teachers,
  flowers,
  byTeacher,
  onChanged,
}: {
  teachers: TeacherInput[] | null;
  flowers: FlowerType[];
  byTeacher: Record<number, number>;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TeacherInput | 'new' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [revealedCode, setRevealedCode] = useState<{ code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const startEditing = (t: TeacherInput | 'new') => {
    setNotice(null);
    setRevealedCode(null);
    setEditing(t);
  };

  if (editing !== null) {
    return (
      <TeacherForm
        value={editing === 'new' ? EMPTY_TEACHER : editing}
        flowers={flowers}
        onCancel={() => setEditing(null)}
        onSaved={(name, code) => {
          setEditing(null);
          onChanged();
          setNotice(`Сохранено: ${name}.`);
          if (code) setRevealedCode({ code, name });
        }}
      />
    );
  }

  const askCode = async (id: number, name: string) => {
    setNotice(null);
    setCopied(false);
    setBusyId(id);
    const res = await getApi().adminGenerateTeacherCode(id);
    setBusyId(null);
    if (res.ok) setRevealedCode({ code: res.code, name });
    else setRowError({ id, text: ERROR_TEXT[res.error] });
  };

  const doDelete = async (id: number, name: string) => {
    setBusyId(id);
    setRowError(null);
    const res = await getApi().adminDeleteTeacher(id);
    setBusyId(null);
    if (!res.ok) {
      setRowError({ id, text: ERROR_TEXT[res.error] });
      return;
    }
    setConfirmDeleteId(null);
    setNotice(
      res.removed > 0
        ? `Удалено: ${name} и ${res.removed} ${plural(res.removed, ['цветок', 'цветка', 'цветов'])} с клумбы. Коды этих учеников снова свободны.`
        : `Удалено: ${name}.`,
    );
    onChanged();
  };

  const printTeacherCard = async () => {
    if (!revealedCode) return;
    const win = openPrintWindow();
    if (win) await printCodeCards(win, defaultSiteUrl(), [revealedCode.code], `Открытка для: ${revealedCode.name}`);
  };

  return (
    <div className="admin-tab">
      <div className="admin-tab__head">
        <p className="admin-tab__lead">Учителя, которых видят ученики при выборе, кому посадить цветок.</p>
        <button type="button" className="btn btn--lime btn--sm" onClick={() => startEditing('new')}>
          + Добавить учителя
        </button>
      </div>

      {notice ? (
        <p className="admin-notice">
          {notice}
          <button type="button" onClick={() => setNotice(null)}>
            Скрыть
          </button>
        </p>
      ) : null}

      {revealedCode ? (
        <div className="admin-code-reveal">
          <p>
            Код для входа ({revealedCode.name}): <strong>{formatCode(revealedCode.code)}</strong> — сохраните его сейчас,
            второй раз он не покажется. Старый код этого человека больше не действует.
          </p>
          <div className="admin-code-reveal__buttons">
            <button
              type="button"
              onClick={async () => setCopied(await copyText(formatCode(revealedCode.code)))}
            >
              {copied ? 'Скопировано ✓' : 'Копировать'}
            </button>
            <button type="button" onClick={printTeacherCard}>
              Карточка с QR
            </button>
            <button type="button" onClick={() => setRevealedCode(null)}>
              Скрыть
            </button>
          </div>
        </div>
      ) : null}

      {teachers === null ? (
        <p className="plant__empty">Загрузка…</p>
      ) : (
        <ul className="admin-teacher-list">
          {teachers.map((t) => (
            <li key={t.id} className={`admin-teacher-row${t.isDirector ? ' admin-teacher-row--director' : ''}`}>
              <span className="admin-teacher-row__dot" style={{ background: t.color }} aria-hidden="true" />
              <span className="admin-teacher-row__text">
                <strong>
                  {t.isDirector ? '🌻 ' : ''}
                  {fullName(t)}
                </strong>
                <span>
                  {t.subject} · посажено {byTeacher[t.id!] ?? 0} · на выбор {t.flowerIds.length}{' '}
                  {plural(t.flowerIds.length, ['цветок', 'цветка', 'цветов'])}
                  {t.isDirector ? ' · центральный подсолнух' : ''}
                  {t.wish.trim() ? '' : ' · без личного пожелания'}
                </span>
              </span>
              <span className="admin-teacher-row__actions">
                {rowError && rowError.id === t.id ? (
                  <>
                    <span className="admin-teacher-row__error">{rowError.text}</span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setRowError(null);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Понятно
                    </button>
                  </>
                ) : confirmDeleteId === t.id ? (
                  <>
                    <span className="admin-teacher-row__confirm">
                      {(byTeacher[t.id!] ?? 0) > 0
                        ? `Удалить вместе с ${byTeacher[t.id!]} ${plural(byTeacher[t.id!], ['цветком', 'цветами', 'цветами'])}?`
                        : 'Удалить?'}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => doDelete(t.id!, fullName(t))}
                      disabled={busyId === t.id}
                    >
                      {busyId === t.id ? 'Удаляем…' : 'Да'}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDeleteId(null)} disabled={busyId === t.id}>
                      Нет
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Новый код для входа"
                      aria-label={`Новый код для входа: ${fullName(t)}`}
                      onClick={() => askCode(t.id!, fullName(t))}
                      disabled={busyId === t.id}
                    >
                      🔑
                    </button>
                    <button type="button" className="icon-btn" title="Изменить" aria-label={`Изменить: ${fullName(t)}`} onClick={() => startEditing(t)}>
                      ✎
                    </button>
                    {t.isDirector ? null : (
                      <button
                        type="button"
                        className="icon-btn"
                        title="Удалить вместе с цветами"
                        aria-label={`Удалить: ${fullName(t)}`}
                        onClick={() => {
                          setConfirmDeleteId(t.id!);
                          setRowError(null);
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
          {teachers.length === 0 ? <li className="plant__empty">Учителей пока нет — добавьте первого.</li> : null}
        </ul>
      )}
    </div>
  );
}

function TeacherForm({
  value,
  flowers,
  onCancel,
  onSaved,
}: {
  value: TeacherInput;
  flowers: FlowerType[];
  onCancel: () => void;
  onSaved: (name: string, newCode?: string) => void;
}) {
  const [form, setForm] = useState<TeacherInput>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = value.id == null;
  const rootRef = useRef<HTMLDivElement>(null);

  // форма может открыться, когда список учителей уже прокручен вниз — без этого не видно ни полей, ни кнопок
  useEffect(() => {
    rootRef.current?.closest('.modal__body')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const toggleFlower = (id: number) =>
    setForm((f) => ({ ...f, flowerIds: f.flowerIds.includes(id) ? f.flowerIds.filter((x) => x !== id) : [...f.flowerIds, id] }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await getApi().adminSaveTeacher(form);
    setBusy(false);
    if (!res.ok) {
      setError(ERROR_TEXT[res.error]);
      return;
    }
    onSaved(fullName(res.teacher), res.code);
  };

  return (
    <div className="admin-tab admin-form" ref={rootRef}>
      <button type="button" className="link-button admin-form__back" onClick={onCancel}>
        ← Назад к списку
      </button>
      <h3 className="admin-tab__title">{isNew ? 'Новый учитель' : `Изменить: ${fullName(value)}`}</h3>

      <div className="admin-form__grid">
        <label className="field">
          <span className="field__label">Имя</span>
          <input className="field__input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Отчество</span>
          <input className="field__input" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Фамилия</span>
          <input className="field__input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Предмет</span>
          <input className="field__input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </label>
      </div>

      <div className="field">
        <span className="field__label">Цвет в легенде клумбы</span>
        <div className="swatches">
          {ACCENT_SWATCHES.map((c) => (
            <label className="swatch" key={c.id}>
              <input type="radio" name="accent" checked={form.color === c.hex} onChange={() => setForm({ ...form, color: c.hex })} />
              <span className="swatch__dot" style={{ background: c.hex }} title={c.name}>
                <span className="sr-only">{c.name}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">Какие цветы можно посадить для этого учителя</span>
        <div className="admin-flowers">
          {flowers.map((f) => (
            <label className="admin-flower" key={f.id}>
              <input type="checkbox" checked={form.flowerIds.includes(f.id)} onChange={() => toggleFlower(f.id)} />
              <span className="admin-flower__card">
                <FlowerPreview kind={f.kind} color={form.color} height={60} label={f.name} />
                <span>{f.name}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Личное пожелание для открытки (необязательно)</span>
        <textarea
          className="field__input admin-textarea"
          rows={5}
          value={form.wish}
          onChange={(e) => setForm({ ...form, wish: e.target.value })}
          placeholder="Если оставить пустым, откроется один из запасных тёплых текстов — тоже неплохо, но своё лучше."
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="dialog__buttons admin-form__actions">
        <button type="button" className="btn btn--lime" onClick={submit} disabled={busy}>
          {busy ? 'Сохраняем…' : isNew ? 'Добавить учителя' : 'Сохранить'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function CodesTab({ stats, onGenerated }: { stats: AdminStats; onGenerated: () => void }) {
  const [count, setCount] = useState(25);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesLabel, setCodesLabel] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);

  const printCards = async () => {
    if (!codes) return;
    const win = openPrintWindow();
    if (win) await printCodeCards(win, defaultSiteUrl(), codes, 'Посади цветок для учителя 🌷', codesLabel);
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await getApi().adminGenerateStudentCodes(count, label);
    setBusy(false);
    if (!res.ok) {
      setError(ERROR_TEXT[res.error]);
      return;
    }
    setCodes(res.codes);
    setCodesLabel(label.trim());
    onGenerated();
  };

  const downloadCsv = async () => {
    setCsvBusy(true);
    const csv = await getApi()
      .adminExportCodes()
      .catch(() => null);
    setCsvBusy(false);
    if (csv === null) {
      setError(ERROR_TEXT.network);
      return;
    }
    // BOM — чтобы Excel открыл русские буквы правильно
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'klumba-codes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-tab">
      <p className="admin-tab__lead">
        Свободных мест на клумбе: {stats.slotsFree} из {stats.slotsTotal}. Один код — один цветок, лишние коды не помешают.
      </p>
      <div className="admin-codes-form">
        <label className="field">
          <span className="field__label">Количество кодов</span>
          <input
            className="field__input"
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span className="field__label">Класс или группа (необязательно)</span>
          <input className="field__input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Например, 9А" />
        </label>
        <button type="button" className="btn btn--lime" onClick={generate} disabled={busy}>
          {busy ? 'Создаём…' : 'Сгенерировать'}
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {codes ? (
        <div className="admin-codes-result">
          <p>Готово: {codes.length} {plural(codes.length, ['код', 'кода', 'кодов'])}. Скопируйте и раздайте ученикам.</p>
          <textarea
            className="field__input admin-textarea"
            rows={6}
            readOnly
            value={codes.join('\n')}
            onFocus={(e: { currentTarget: HTMLTextAreaElement }) => e.currentTarget.select()}
          />
          <div className="dialog__buttons">
            <button type="button" className="btn btn--lime btn--sm" onClick={printCards}>
              Распечатать карточки с QR
            </button>
            <span className="admin-hint">На каждой карточке — код и QR: ученик наводит камеру и сразу попадает на сайт уже со своим кодом.</span>
          </div>
        </div>
      ) : null}

      <button type="button" className="btn btn--ghost admin-csv-btn" onClick={downloadCsv} disabled={csvBusy}>
        {csvBusy ? 'Готовим файл…' : 'Скачать все коды (CSV)'}
      </button>
    </div>
  );
}

function QrTab() {
  const [url, setUrl] = useState(() => defaultSiteUrl());
  const [png, setPng] = useState<string | null>(null);
  const valid = /^https?:\/\/[^\s]+$/i.test(url.trim());

  useEffect(() => {
    let alive = true;
    if (!valid) {
      setPng(null);
      return;
    }
    qrPng(url.trim())
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null));
    return () => {
      alive = false;
    };
  }, [url, valid]);

  const poster = async () => {
    const win = openPrintWindow();
    if (win) await printPoster(win, url.trim());
  };

  return (
    <div className="admin-tab">
      <p className="admin-tab__lead">
        QR-код ведёт на главную страницу сайта. Повесьте плакат в школе или покажите QR на экране — ученикам не придётся
        набирать адрес. Коды учеников и учителей тоже можно распечатать карточками с QR (разделы «Коды ученикам» и «Учителя»):
        такой QR сразу открывает сайт с уже введённым кодом.
      </p>
      <label className="field">
        <span className="field__label">Адрес сайта</span>
        <input className="field__input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://klumba-ok10.ru" />
      </label>
      {!valid ? <p className="form-error">Адрес должен начинаться с https:// (или http://).</p> : null}
      {png ? (
        <div className="admin-qr">
          <img src={png} alt={`QR-код: ${url}`} width={220} height={220} />
          <div className="dialog__buttons">
            <a className="btn btn--lime btn--sm" href={png} download="klumba-qr.png">
              Скачать PNG
            </a>
            <button type="button" className="btn btn--ghost btn--sm" onClick={poster}>
              Плакат для печати
            </button>
          </div>
          <p className="admin-hint">Пример ссылки с кодом (как на карточках): {codeLink(url.trim(), 'XXXXX-XXXXX').replace(/XXXXX-XXXXX$/, '…')}</p>
        </div>
      ) : null}
    </div>
  );
}
