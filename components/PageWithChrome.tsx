// components/PageWithChrome.tsx
'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function PageWithChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}