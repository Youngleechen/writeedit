import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { MainHeader } from '@/components/layout/MainHeader';
import { MainFooter } from '@/components/layout/MainFooter';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Before Publishing — Editorial Board',
  description: 'Professional AI editing with editorial oversight',
  metadataBase: new URL('https://your-custom-domain.com'),
  openGraph: {
    title: 'Before Publishing',
    description: 'Professional AI editing with editorial oversight',
    url: 'https://your-custom-domain.com',
    siteName: 'Before Publishing',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Before Publishing',
    description: 'Professional AI editing with editorial oversight',
    creator: '@yourhandle',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} flex min-h-screen flex-col bg-gray-50`}>
        <MainHeader />
        <main className="container mx-auto my-8 flex-grow px-4">
          {children}
        </main>
        <MainFooter />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}