import { Fredoka, Poppins } from 'next/font/google';

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Careers - Acme Talent',
  description: 'Join our team at Acme Talent',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${fredoka.variable} ${poppins.variable}`}>
      {children}
    </div>
  );
}
