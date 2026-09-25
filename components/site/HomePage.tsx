'use client';

import { AccountDialog } from '@/components/account/AccountDialog';
import { AccountProvider } from '@/components/account/AccountProvider';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { useEventStatus } from '@/components/garden/useGarden';
import { DEFAULT_GREETING } from '@/lib/content';
import { LeafGarland } from './Decor';
import { Footer } from './Footer';
import { GardenSection } from './GardenSection';
import { GreetingSection } from './GreetingSection';
import { Header } from './Header';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';

function Page() {
  const status = useEventStatus();
  return (
    <div className="site">
      <Header />
      <main>
        <Hero status={status} />
        <GreetingSection greeting={DEFAULT_GREETING} />
        <LeafGarland />
        <HowItWorks />
        <LeafGarland />
        <GardenSection />
      </main>
      <Footer />
      <AccountDialog />
      <AdminPanel />
    </div>
  );
}

/**
 * Главная страница. Сейчас тексты берутся из lib/content.ts, данные клумбы — из демо (lib/api/demo.ts);
 * на этапах «Realtime» и «Админка» они будут приходить из Supabase.
 */
export function HomePage() {
  return (
    <AccountProvider>
      <Page />
    </AccountProvider>
  );
}
