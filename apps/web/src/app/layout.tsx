import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WMM — Where\'s My Money',
  description: 'Controle financeiro pessoal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full`}>
      <body className="h-full bg-slate-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
