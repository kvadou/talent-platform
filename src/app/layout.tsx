import { SessionProvider } from '@/components/providers/SessionProvider';
import type { Metadata } from 'next';
import { Poppins, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Primary font for all text (STC brand standard)
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

// Monospace font for code
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hiring Hub | Acme Talent',
  description: 'Your central place to find great tutors'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <html lang="en" className={`${poppins.variable} ${jetbrainsMono.variable}`}>
        <body className="min-h-screen font-sans antialiased">
          {children}
        </body>
      </html>
    </SessionProvider>
  );
}
