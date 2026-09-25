'use client';

import { AccountDialog } from '@/components/account/AccountDialog';
import { AccountProvider } from '@/components/account/AccountProvider';
import { useEffect, useState } from 'react';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { BigScreen } from '@/components/screen/BigScreen';
import { useEventStatus } from '@/components/garden/useGarden';
import { DEFAULT_GREETING } from '@/lib/content';
import { LeafGarland } from './Decor';
import { PageLeaves } from './PageLeaves';
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
      <PageLeaves />
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

/** Адрес с ?screen (или #screen) открывает режим для большого экрана. */
function isScreenMode(): boolean {
  const { search, hash } = window.location;
  return new URLSearchParams(search).has('screen') || hash === '#screen';
}

/** Главная страница (или режим большого экрана). Данные — через lib/api: сервер или демо. */
export function HomePage() {
  const [screen, setScreen] = useState(false);
  useEffect(() => {
    const check = () => setScreen(isScreenMode());
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  if (screen) return <BigScreen />;
  return (
    <AccountProvider>
      <Page />
    </AccountProvider>
  );
}
