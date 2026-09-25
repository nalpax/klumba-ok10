import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { demoState } from '@/lib/core/demoSeed';
import { DIRECTOR_ID, emptyState, makeDirector, type GardenState } from '@/lib/core/state';
import { ALL_FLOWER_IDS } from '@/lib/garden/catalog';

/**
 * Хранилище клумбы — один JSON-файл в папке DATA_DIR (по умолчанию ./data).
 * Для одной школы (1–2 тысячи цветов, ~100 человек одновременно) этого с большим запасом хватает:
 * всё состояние держится в памяти, файл перезаписывается атомарно (временный файл + rename)
 * через доли секунды после каждого изменения, раз в 10 минут делается резервная копия.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'klumba.json');
const BACKUP = path.join(DATA_DIR, 'klumba.backup.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
const BACKUP_EVERY_MS = 10 * 60 * 1000;

interface Holder {
  state: GardenState;
  secret: Buffer;
  timer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  lastBackup: number;
}

const g = globalThis as typeof globalThis & { __klumba?: Holder };

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readState(): GardenState {
  if (fs.existsSync(FILE)) {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8')) as GardenState;
    // директор должен быть всегда (например, если файл правили руками)
    if (!parsed.teachers.some((t) => t.isDirector)) {
      const taken = parsed.teachers.some((t) => t.id === DIRECTOR_ID);
      const director = makeDirector(ALL_FLOWER_IDS);
      if (taken) director.id = parsed.nextTeacherId++;
      parsed.teachers.unshift(director);
    }
    return parsed;
  }
  const fresh = process.env.SEED_DEMO === '1' ? demoState() : emptyState(ALL_FLOWER_IDS);
  return fresh;
}

function readSecret(): Buffer {
  if (fs.existsSync(SECRET_FILE)) return Buffer.from(fs.readFileSync(SECRET_FILE, 'utf8').trim(), 'hex');
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_FILE, secret.toString('hex'), { mode: 0o600 });
  return secret;
}

function writeNow(h: Holder) {
  if (h.timer) {
    clearTimeout(h.timer);
    h.timer = null;
  }
  if (!h.dirty) return;
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(h.state));
  fs.renameSync(tmp, FILE);
  h.dirty = false;
  const now = Date.now();
  if (now - h.lastBackup > BACKUP_EVERY_MS) {
    fs.copyFileSync(FILE, BACKUP);
    h.lastBackup = now;
  }
}

function holder(): Holder {
  if (!g.__klumba) {
    ensureDir();
    const h: Holder = { state: readState(), secret: readSecret(), timer: null, dirty: true, lastBackup: 0 };
    g.__klumba = h;
    writeNow(h);
    // при остановке сервера дописываем несохранённое
    process.on('exit', () => {
      try {
        writeNow(h);
      } catch {
        /* нечего сделать */
      }
    });
  }
  return g.__klumba;
}

export function getState(): GardenState {
  return holder().state;
}

/** Отметить, что состояние изменилось: файл запишется через 150 мс (несколько изменений подряд — одной записью). */
export function markDirty() {
  const h = holder();
  h.dirty = true;
  if (!h.timer) {
    h.timer = setTimeout(() => {
      try {
        writeNow(h);
      } catch (e) {
        console.error('[klumba] не удалось сохранить данные', e);
      }
    }, 150);
  }
}

export function getSecret(): Buffer {
  return holder().secret;
}
