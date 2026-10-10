import type { Metadata } from 'next';
import './globals.css';
import './concept.css';
import './landing-v3.css';
import './experience.css';
import './auth-concept.css';
import './monetization.css';
import {LocaleProvider} from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Conecta — Sua comunidade, seu mundo',
  description: 'Conecta: comunidades, histórias, Reels, conversas, perfis personalizados e acolhimento para mães atípicas. Uma rede social para pertencer.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
