import type { GardenSnapshot } from './api/types';

declare global {
  interface Window {
    /** Снимок клумбы из archive.json — если он лежит рядом со страницей (см. scripts/preview-entry.tsx). */
    __KLUMBA_ARCHIVE__?: GardenSnapshot;
  }
}

/**
 * Архив клумбы (только просмотр после праздника): без входа, кодов и админки.
 * Включается сборкой с NEXT_PUBLIC_ARCHIVE=1 или сам — если рядом со статической страницей лежит archive.json.
 */
export function isArchive(): boolean {
  return process.env.NEXT_PUBLIC_ARCHIVE === '1' || (typeof window !== 'undefined' && !!window.__KLUMBA_ARCHIVE__);
}
