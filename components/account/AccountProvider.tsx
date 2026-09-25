'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApi, type ApiError, type TeacherInfo } from '@/lib/api';
import { normalizeCode } from '@/lib/codes';
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
  openDialog: () => void;
  closeDialog: () => void;
  /** Большая панель администратора — отдельно от маленького окна входа/кабинета. */
  adminPanelOpen: boolean;
  openAdminPanel: () => void;
  closeAdminPanel: () => void;
  login: (code: string) => Promise<Outcome>;
  logout: () => void;
  applyPlanted: (planting: Planting) => void;
  openCard: () => Promise<Outcome>;
}

const AccountContext = createContext<AccountValue | null>(null);
const STORAGE_KEY = 'klumba-code';

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStored(code: string | null) {
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* хранилище недоступно — вход просто не запомнится */
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const login = useCallback(async (raw: string): Promise<Outcome> => {
    // Само слово/код нормализует lib/api/demo.ts (по-разному для слова администратора
    // и для 10-значных кодов) — здесь только убираем пробелы по краям.
    const trimmed = raw.trim();
    try {
      const res = await getApi().login(trimmed);
      if (!res.ok) return { ok: false, error: res.error };
      if (res.role === 'admin') {
        setSession({ role: 'admin' });
        writeStored(trimmed);
        return { ok: true, role: 'admin' };
      }
      const code = normalizeCode(trimmed);
      if (res.role === 'teacher') {
        setSession({ role: 'teacher', code, teacher: res.teacher, planted: res.planted, wish: null });
      } else if (res.status === 'used') {
        setSession({ role: 'student', code, status: 'used', planting: res.planting });
      } else {
        setSession({ role: 'student', code, status: 'unused', planting: null });
      }
      writeStored(code);
      return { ok: true, role: res.role };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  // при открытии страницы возвращаем вход, если код был сохранён
  useEffect(() => {
    let alive = true;
    const stored = readStored();
    if (!stored) {
      setReady(true);
      return;
    }
    login(stored).then((res) => {
      if (!alive) return;
      if (!res.ok && res.error === 'invalid_code') writeStored(null);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [login]);

  const logout = useCallback(() => {
    writeStored(null);
    setSession(null);
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
      openDialog: () => setDialogOpen(true),
      closeDialog: () => setDialogOpen(false),
      adminPanelOpen,
      openAdminPanel: () => setAdminPanelOpen(true),
      closeAdminPanel: () => setAdminPanelOpen(false),
      login,
      logout,
      applyPlanted,
      openCard,
    }),
    [session, ready, dialogOpen, adminPanelOpen, login, logout, applyPlanted, openCard],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount нужно вызывать внутри <AccountProvider>');
  return ctx;
}
