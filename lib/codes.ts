/**
 * Коды участников.
 * Алфавит из 20 знаков подобран так, чтобы ничего нельзя было спутать (и на бумаге, и с экрана):
 * нет 0, O, Q, D-подобных пар, 1, I, L, 2, Z, 5, S, 6, G, 8, B, U, V.
 * Код — 10 знаков, показывается как XXXXX-XXXXX. Вариантов ≈ 10¹³.
 * Те же правила повторены в SQL: supabase/migrations/0003_functions.sql.
 */
export const CODE_ALPHABET = 'ACDEFHJKMNPRTWXY3479';
export const CODE_LENGTH = 10;

// Русские буквы, которые выглядят как латинские: человек с русской раскладкой вводит их «на автомате».
const LOOKALIKES: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y',
};

/** Убирает пробелы и дефисы, делает буквы заглавными, заменяет русские двойники латиницей. */
export function normalizeCode(input: string): string {
  let out = '';
  for (const ch of input.toUpperCase()) {
    if (/[\s\-_.–—]/.test(ch)) continue;
    out += LOOKALIKES[ch] ?? ch;
  }
  return out;
}

/** XXXXX-XXXXX. Можно передавать и уже отформатированный код — дефис не задвоится. */
export function formatCode(code: string): string {
  const n = normalizeCode(code);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}

/**
 * Достаёт код из того, что ввёл или вставил человек: лишние пробелы, дефисы, кавычки,
 * слово «Код:» перед ним — всё это не помеха. null — 10 знаков кода так и не нашлось.
 */
export function extractCode(input: string): string | null {
  const n = normalizeCode(input);
  if (isValidCodeShape(n)) return n;
  const parts = n.replace(/[^A-Z0-9]/g, ' ').split(' ');
  return parts.find((part) => isValidCodeShape(part)) ?? null;
}

export function isValidCodeShape(normalized: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(normalized);
}

/**
 * Слово-код администратора — отдельная, более простая проверка: только убираем
 * пробелы по краям и регистр, без замены похожих букв (это не общий код на 10 знаков,
 * а обычное слово, которое администратор придумывает сам).
 */
export function normalizeWord(input: string): string {
  return input.trim().toUpperCase();
}
