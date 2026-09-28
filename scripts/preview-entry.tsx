import { createRoot } from 'react-dom/client';
import { HomePage } from '@/components/site/HomePage';
import type { GardenSnapshot } from '@/lib/api/types';

/**
 * Статическая страница (без сервера). Если рядом лежит archive.json (скачан в админке кнопкой
 * «Скачать архив клумбы»), страница сама становится архивом: настоящая клумба только для просмотра.
 * Иначе — демо. Так архив можно выложить без сборки: просто загрузить archive.json рядом с index.html.
 */
async function start() {
  if (process.env.NEXT_PUBLIC_DEMO === '1') {
    try {
      const res = await fetch('archive.json', { cache: 'no-cache' });
      if (res.ok) {
        const snap = (await res.json()) as GardenSnapshot;
        if (Array.isArray(snap?.plantings) && Array.isArray(snap?.teachers)) window.__KLUMBA_ARCHIVE__ = snap;
      }
    } catch {
      /* архива нет — показываем демо */
    }
  }
  createRoot(document.getElementById('root')!).render(<HomePage />);
}

start();
