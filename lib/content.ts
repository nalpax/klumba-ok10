/**
 * Тексты по умолчанию. На этапе «Админка» они переезжают в таблицы greeting / events,
 * а эти значения остаются запасными, если база недоступна.
 */
export interface Greeting {
  title: string;
  body: string;
  signature: string;
  extra: string;
}

export const DEFAULT_GREETING: Greeting = {
  title: 'Дорогие учителя!',
  body:
    'Спасибо вам за знания, терпение, поддержку и вдохновение. Каждый день вы помогаете нам становиться лучше, открывать новое и верить в свои силы.\n\n' +
    'В этот день мы хотим сказать вам большое спасибо за ваш труд, заботу и время, которое вы дарите нам.',
  signature: 'С Днём учителя! 🌷',
  extra: 'Ученики Образовательного комплекса №\u00A010',
};

export type EventStatus = 'draft' | 'open' | 'closed';

export const STATUS_TEXT: Record<EventStatus, string> = {
  draft: 'Клумба скоро откроется',
  open: 'Посадка открыта',
  closed: 'Клумба готова',
};

/** Финальный экран, который видят гости, когда посадка завершена (events.closed_title/closed_text/show_stats). */
export interface ClosingContent {
  title: string;
  text: string;
  showStats: boolean;
}

export const DEFAULT_CLOSING: ClosingContent = {
  title: 'Наша клумба готова!',
  text: 'Спасибо всем, кто посадил свой цветок для наших учителей.',
  showStats: true,
};

export const SCHOOL = {
  complex: 'Образовательный комплекс №\u00A010',
  complexGenitive: 'Образовательного комплекса №\u00A010',
  city: 'Ярославль',
  // пути без «/» в начале: сайт работает и в корне домена, и в подпапке
  emblem: 'brand/sunflower-ok10.webp',
};
