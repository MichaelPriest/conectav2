import type { Metadata } from 'next';
import './globals.css';
import './concept.css';

export const metadata: Metadata = {
  title: 'Conecta — Sua comunidade, seu mundo',
  description: 'Uma nova forma de se conectar, compartilhar e participar de comunidades.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
