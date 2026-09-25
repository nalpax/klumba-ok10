import crypto from 'node:crypto';
import { normalizeWord } from '@/lib/codes';
import { getSecret } from './store';

/* ------------------------------ пароль администратора ------------------------------ */

/**
 * Пароль администратора задаётся переменной окружения ADMIN_PASSWORD. В браузер он не попадает:
 * после входа браузер получает подписанный ключ сессии на 14 дней.
 * При локальной разработке (npm run dev) без переменной работает слово ПОДСОЛНУХ.
 */
function adminPassword(): string | null {
  const env = process.env.ADMIN_PASSWORD?.trim();
  if (env) return env;
  return process.env.NODE_ENV === 'production' ? null : 'ПОДСОЛНУХ';
}

export function adminLoginEnabled(): boolean {
  return adminPassword() !== null;
}

export function checkAdminPassword(input: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  const a = crypto.createHash('sha256').update(normalizeWord(input)).digest();
  const b = crypto.createHash('sha256').update(normalizeWord(pw)).digest();
  return crypto.timingSafeEqual(a, b);
}

const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  // пароль входит в подпись: если его сменить, все старые сессии перестают действовать
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${payload}|${adminPassword() ?? ''}`)
    .digest('base64url');
}

export function issueAdminToken(): string {
  const payload = `admin.${Date.now() + SESSION_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token || !adminPassword()) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

/* --------------------------------- ограничение попыток --------------------------------- */

interface Bucket {
  count: number;
  reset: number;
}
const buckets = new Map<string, Bucket>();

/**
 * Не больше limit неудачных попыток за windowMs с одного адреса. Порог для кодов высокий:
 * весь класс может сидеть за одним школьным Wi-Fi (один внешний адрес).
 */
export function isLimited(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return !!b && b.reset > Date.now() && b.count >= limit;
}

export function registerFailure(key: string, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) buckets.set(key, { count: 1, reset: now + windowMs });
  else b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'local';
}
