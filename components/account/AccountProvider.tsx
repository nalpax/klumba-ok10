'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApi, type ApiError, type TeacherInfo } from '@/lib/api';
import { extractCode, normalizeCode } from '@/lib/codes';
import type { Planting } from '@/lib/garden/types';

export interface StudentSession {
  role: 'student';
  code: string;
  status: 'unused' | 'used';
  planting: Planting | null;
}

export interface TeacherSession {
  role: 'teacher';
  code: string;
  teacher: TeacherInfo;
  planted: number;
  /** Личное пожелание. null — открытка ещё не открыта: текста на странице нет. */
  wish: string | null;
}

export interface AdminSession {
  role: 'admin';
}

export type Session = StudentSession | TeacherSession | AdminSession;

type Outcome = { ok: true; role?: Session['role'] } | { ok: false; error: ApiError };

interface AccountValue {
  session: Session | null;
  /** false, пока проверяем код, сохранённый с прошлого посещения */
  ready: boolean;
  dialogOpen: boolean;
  /** 'director' — то же окно входа, но с обращением к директору. */
  dialogMode: 'default' | 'director';
  openDialog: (mode?: 'default' | 'director') => void;
  closeDialog: () => void;
  /** Большая панель администратора — отдельно от маленького окна входа/кабинета. */
  adminPanelOpen: boolean;
  openAdminPanel: () => void;
  closeAdminPanel: () => void;
  login: (code: string) => Promise<Outcome>;
  /** Код из ссылки (?code=…, например из QR на карточке) — подставляется в окно входа. */
  linkCode: string | null;
  logout: () => void;
  applyPlanted: (planting: Planting) => void;
  openCard: () => Promise<Outcome>;
}

const AccountContext = createContext<AccountValue | null>(null);
const STORAGE_KEY = 'klumba-code';
const ADMIN_KEY = 'klumba-admin';

function readStored(key = STORAGE_KEY): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(code: string | null, key = STORAGE_KEY) {
  try {
    if (code) window.localStorage.setItem(key, code);
    else window.localStorage.removeItem(key);
  } catch {
    /* хранилище недоступно — вход просто не запомнится */
  }
}

let linkCodeCache: string | null | undefined;

/**
 * Забирает ?code=… из адреса и убирает его оттуда, чтобы код не остался в истории и закладках.
 * Результат запоминается: эффект может выполниться дважды (StrictMode), а адрес к тому времени уже чистый.
 */
function takeLinkCode(): string | null {
  if (linkCodeCache !== undefined) return linkCodeCache;
  linkCodeCache = null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('code');
    if (raw !== null) {
      url.searchParams.delete('code');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      linkCodeCache = extractCode(raw);
    }
  } catch {
    /* адрес не разобрать — входим как обычно */
  }
  return linkCodeCache;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'default' | 'director'>('default');
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  const login = useCallback(async (raw: string): Promise<Outcome> => {
    // 10-значный код достаём из ввода (пробелы, дефисы, «Код:» не мешают);
    // всё остальное отправляем как есть — это может быть пароль администратора.
    const trimmed = raw.trim();
    const extracted = extractCode(trimmed);
    try {
      const res = await getApi().login(extracted ?? trimmed);
      if (!res.ok) return { ok: false, error: res.error };
      if (res.role === 'admin') {
        setSession({ role: 'admin' });
        writeStored(res.token, ADMIN_KEY);
        writeStored(null);
        return { ok: true, role: 'admin' };
      }
      const code = normalizeCode(extracted ?? trimmed);
      if (res.role === 'teacher') {
        setSession({ role: 'teacher', code, teacher: res.teacher, planted: res.planted, wish: null });
      } else if (res.status === 'used') {
        setSession({ role: 'student', code, status: 'used', planting: res.planting });
      } else {
        setSession({ role: 'student', code, status: 'unused', planting: null });
      }
      writeStored(code);
      writeStored(null, ADMIN_KEY);
      return { ok: true, role: res.role };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  // при открытии страницы: код из ссылки (QR) важнее; иначе возвращаем сохранённый вход
  useEffect(() => {
    let alive = true;
    const fromLink = takeLinkCode();
    const adminToken = readStored(ADMIN_KEY);
    const stored = readStored();

    const finish = () => alive && setReady(true);
    if (fromLink) {
      login(fromLink).then((res) => {
        if (!alive) return;
        if (!res.ok) {
          // не вошли (например, посадка ещё не открыта) — показываем окно с кодом и причиной
          setLinkCode(fromLink);
          setDialogOpen(true);
        } else if (res.role !== 'admin') {
          setDialogOpen(true);
        }
        finish();
      });
    } else if (adminToken) {
      getApi()
        .restoreAdmin(adminToken)
        .then((ok) => {
          if (!alive) return;
          if (ok) setSession({ role: 'admin' });
          else writeStored(null, ADMIN_KEY);
          finish();
        })
        .catch(finish);
    } else if (stored) {
      login(stored).then((res) => {
        if (!alive) return;
        if (!res.ok && res.error === 'invalid_code') writeStored(null);
        finish();
      });
    } else {
      finish();
    }
    return () => {
      alive = false;
    };
  }, [login]);

  const logout = useCallback(() => {
    writeStored(null);
    writeStored(null, ADMIN_KEY);
    getApi()
      .adminLogout()
      .catch(() => {});
    setSession(null);
    setLinkCode(null);
    setDialogOpen(false);
    setAdminPanelOpen(false);
  }, []);

  const applyPlanted = useCallback((planting: Planting) => {
    setSession((s) => (s && s.role === 'student' ? { ...s, status: 'used', planting } : s));
  }, []);

  const openCard = useCallback(async (): Promise<Outcome> => {
    if (!session || session.role !== 'teacher') return { ok: false, error: 'invalid_code' };
    try {
      const res = await getApi().openCard(session.code);
      if (!res.ok) return { ok: false, error: res.error };
      setSession({ ...session, wish: res.wish, planted: res.planted });
      return { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, [session]);

  const value = useMemo<AccountValue>(
    () => ({
      session,
      ready,
      dialogOpen,
      dialogMode,
      openDialog: (mode = 'default') => {
        setDialogMode(mode === 'director' ? 'director' : 'default');
        setDialogOpen(true);
      },
      closeDialog: () => setDialogOpen(false),
      adminPanelOpen,
      openAdminPanel: () => setAdminPanelOpen(true),
      closeAdminPanel: () => setAdminPanelOpen(false),
      login,
      linkCode,
      logout,
      applyPlanted,
      openCard,
    }),
    [session, ready, dialogOpen, dialogMode, adminPanelOpen, login, linkCode, logout, applyPlanted, openCard],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount нужно вызывать внутри <AccountProvider>');
  return ctx;
}
