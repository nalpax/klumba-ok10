import { NextResponse, type NextRequest } from 'next/server';
import type { ApiError, TeacherInput } from '@/lib/api/types';
import { isValidCodeShape, normalizeCode } from '@/lib/codes';
import * as engine from '@/lib/core/engine';
import {
  adminLoginEnabled,
  checkAdminPassword,
  clientIp,
  isLimited,
  issueAdminToken,
  registerFailure,
  verifyAdminToken,
} from '@/lib/server/security';
import { getState, markDirty } from '@/lib/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE_LIMIT = 60; // неудачных вводов кода за 10 минут с одного адреса
const CODE_WINDOW = 10 * 60 * 1000;
const ADMIN_LIMIT = 10; // неудачных вводов пароля администратора за 15 минут
const ADMIN_WINDOW = 15 * 60 * 1000;
const MAX_BODY = 32 * 1024;

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const err = (error: ApiError, status = 200) => json({ ok: false, error }, status);

type Ctx = { params: Promise<{ action: string }> };

/* ------------------------------------ GET ------------------------------------ */

export async function GET(req: NextRequest, ctx: Ctx) {
  const { action } = await ctx.params;
  const state = getState();

  switch (action) {
    case 'garden':
      return json(engine.snapshot(state));
    case 'updates': {
      // лёгкий опрос раз в несколько секунд: только новые цветы и номер версии
      const after = Number(req.nextUrl.searchParams.get('after') ?? 0) || 0;
      return json({ version: state.version, plantings: engine.plantingsAfter(state, after) });
    }
    case 'slots':
      return json(engine.freeSlots(state));
    case 'health':
      return json({ ok: true, plantings: state.plantings.length });
    default:
      return err('validation', 404);
  }
}

/* ------------------------------------ POST ------------------------------------ */

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { action } = await ctx.params;
  const body = await readBody(req);
  if (!body) return err('validation', 400);
  const state = getState();
  const ip = clientIp(req.headers);

  // --- публичные действия ---
  if (action === 'login' || action === 'plant' || action === 'card') {
    const raw = String(body.code ?? '').slice(0, 100);
    const looksLikeCode = isValidCodeShape(normalizeCode(raw));

    if (action === 'login' && !looksLikeCode) {
      // не похоже на 10-значный код — возможно, это пароль администратора
      if (isLimited(`admin:${ip}`, ADMIN_LIMIT)) return err('rate_limited');
      if (adminLoginEnabled() && checkAdminPassword(raw)) {
        return json({ ok: true, role: 'admin', token: issueAdminToken() });
      }
      registerFailure(`admin:${ip}`, ADMIN_WINDOW);
      return err('invalid_code');
    }

    if (isLimited(`code:${ip}`, CODE_LIMIT)) return err('rate_limited');
    let res;
    if (action === 'login') res = engine.login(state, raw);
    else if (action === 'card') res = engine.openCard(state, raw);
    else {
      res = engine.plant(state, {
        code: raw,
        teacherId: Number(body.teacherId),
        flowerId: Number(body.flowerId),
        color: String(body.color ?? ''),
        slotId: Number(body.slotId),
      });
      if (res.ok) markDirty();
    }
    if (!res.ok && res.error === 'invalid_code') registerFailure(`code:${ip}`, CODE_WINDOW);
    return json(res);
  }

  // --- действия администратора: только с действующим ключом сессии ---
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyAdminToken(token)) return err('unauthorized', 401);

  switch (action) {
    case 'admin-check':
      return json({ ok: true });
    case 'admin-stats':
      return json(engine.adminStats(state));
    case 'admin-status': {
      const res = engine.setStatus(state, body.status as never);
      if (res.ok) markDirty();
      return json(res);
    }
    case 'admin-closing': {
      const res = engine.setClosing(state, body.closing as never);
      if (res.ok) markDirty();
      return json(res);
    }
    case 'admin-teachers':
      return json(engine.listTeachers(state));
    case 'admin-save-teacher': {
      const res = engine.saveTeacher(state, body.teacher as TeacherInput);
      if (res.ok) markDirty();
      return json(res);
    }
    case 'admin-delete-teacher': {
      const res = engine.deleteTeacher(state, Number(body.id));
      if (res.ok) markDirty();
      return json(res);
    }
    case 'admin-student-codes': {
      const res = engine.generateStudentCodes(state, Number(body.count), String(body.label ?? ''));
      if (res.ok) markDirty();
      return json(res);
    }
    case 'admin-teacher-code': {
      const res = engine.generateTeacherCode(state, Number(body.teacherId));
      if (res.ok) markDirty();
      return json(res);
    }
    case 'admin-export':
      return json({ ok: true, csv: engine.exportCodes(state) });
    default:
      return err('validation', 404);
  }
}
