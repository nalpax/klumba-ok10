import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Lora, Manrope } from 'next/font/google';
import './globals.css';

// Шрифты подключаются через next/font: файлы скачиваются при сборке и отдаются с вашего же домена,
// поэтому посетителям не нужен доступ к fonts.googleapis.com.
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});
const lora = Lora({
  subsets: ['latin', 'cyrillic'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'С Днём учителя! Клумба Образовательного комплекса № 10',
  description:
    'Каждый ученик сажает один цветок, а вместе мы создаём большую виртуальную клумбу в честь наших учителей.',
  openGraph: {
    title: 'С Днём учителя!',
    description: 'Посадите свой цветок на общей клумбе для наших учителей.',
    images: ['/hero/autumn-card.jpg'],
    locale: 'ru_RU',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#040805',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
