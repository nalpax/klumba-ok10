'use client';

import { useAccount } from '@/components/account/AccountProvider';
import type { Greeting } from '@/lib/content';
import { GreetingCard } from './GreetingCard';
import { StudentWish } from './StudentWish';

/**
 * Учителям и гостям — общее поздравление (написано учениками, о них самих ничего не говорит).
 * Ученику, который вошёл по своему коду, вместо этого показываем личное пожелание на учебный год —
 * поздравлять учителей он и так пришёл (цветком), а здесь — что-то для него самого.
 */
export function GreetingSection({ greeting }: { greeting: Greeting }) {
  const { session } = useAccount();
  return session?.role === 'student' ? <StudentWish /> : <GreetingCard greeting={greeting} />;
}
