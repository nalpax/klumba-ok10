// Справочник для PHP-сервера (php/api.php): всё, что Node-сервер берёт из lib/, одним JSON-файлом.
import { DEFAULT_CLOSING } from '@/lib/content';
import { demoState } from '@/lib/core/demoSeed';
import { emptyState } from '@/lib/core/state';
import { ALL_FLOWER_IDS, FLOWERS } from '@/lib/garden/catalog';
import { FLOWER_COLORS } from '@/lib/garden/palette';
import { allSlots } from '@/lib/garden/slots';

export function catalog() {
  return {
    flowers: FLOWERS,
    colors: FLOWER_COLORS,
    slots: allSlots(),
    closing: DEFAULT_CLOSING,
    empty: emptyState(ALL_FLOWER_IDS),
    demo: demoState(),
  };
}
