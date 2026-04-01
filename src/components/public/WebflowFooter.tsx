import Image from 'next/image';

const STC_BASE = 'https://acmetalent.com';
const LOGO_URL = 'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/6849c92715d2914bcb05d69b_STC%20Logo%20COLOR%20CURRENT%202024.png';

const COLUMNS = [
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: `${STC_BASE}/about-us` },
      { label: 'Careers', href: `${STC_BASE}/careers` },
      { label: 'Contact Us', href: `${STC_BASE}/contact-us` },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'FAQs', href: `${STC_BASE}/faq` },
      { label: 'Blog', href: `${STC_BASE}/blog` },
      { label: 'Franchise', href: 'https://franchising.acmetalent.com/' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Terms & Conditions', href: `${STC_BASE}/#` },
      { label: 'Privacy Policy', href: `${STC_BASE}/privacy-policy` },
    ],
  },
];

const SOCIALS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/AcmeTalentOfficial',
    icon: (
      <svg width="8" height="18" viewBox="0 0 8 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.16 18V9.79h2.72l.41-3.16H5.16V4.57c0-.92.25-1.54 1.57-1.54H8.4V.13C8.12.09 7.13 0 5.98 0 3.58 0 1.95 1.45 1.95 4.11v2.52H0v3.16h1.95V18h3.21z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/acme-talent-official',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.02 18H.3V5.98h3.72V18zM2.16 4.34C.97 4.34 0 3.36 0 2.17 0 .97.97 0 2.16 0c1.18 0 2.15.97 2.15 2.17 0 1.19-.97 2.17-2.15 2.17zM18 18h-3.72v-5.85c0-1.39-.03-3.19-1.94-3.19-1.95 0-2.25 1.52-2.25 3.09V18H6.38V5.98h3.56v1.64h.05c.5-.94 1.72-1.94 3.54-1.94 3.78 0 4.48 2.49 4.48 5.73V18z" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@acmetalent',
    icon: (
      <svg width="18" height="21" viewBox="0 0 18 21" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.53.02c.98-.01 1.96-.01 2.93-.01.06 1.15.47 2.32 1.31 3.13.84.83 2.03 1.22 3.18 1.34v3.02c-1.08-.04-2.17-.26-3.15-.73-.43-.2-.83-.44-1.22-.7-.01 2.19.01 4.38-.02 6.56-.06 1.05-.41 2.09-1.01 2.96-.98 1.44-2.69 2.38-4.43 2.41-1.07.06-2.15-.23-3.06-.77-1.52-.9-2.58-2.53-2.74-4.29-.02-.38-.02-.75-.01-1.12.14-1.43.84-2.79 1.94-3.72 1.25-1.08 2.99-1.6 4.61-1.29.02 1.11-.03 2.22-.03 3.33-.74-.24-1.61-.17-2.27.28-.47.31-.83.78-1.02 1.31-.16.38-.11.8-.11 1.21.18 1.23 1.37 2.27 2.63 2.15.84-.01 1.64-.5 2.08-1.21.14-.25.3-.5.31-.8.08-1.34.05-2.68.05-4.02.01-3.02-.01-6.04.02-9.05z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/acmetalentofficial/',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 1.62c2.4 0 2.69.01 3.64.05 2.44.11 3.58 1.27 3.69 3.69.04.95.05 1.24.05 3.64s-.01 2.69-.05 3.64c-.11 2.42-1.25 3.58-3.69 3.69-.95.04-1.23.05-3.64.05s-2.69-.01-3.64-.05c-2.45-.11-3.58-1.28-3.69-3.69C1.63 11.69 1.62 11.4 1.62 9s.01-2.69.05-3.64c.11-2.42 1.25-3.58 3.69-3.69.95-.04 1.24-.05 3.64-.05zM9 0C6.56 0 6.25.01 5.29.05 1.97.2.2 1.97.05 5.29.01 6.25 0 6.56 0 9s.01 2.75.05 3.71c.15 3.32 1.92 5.09 5.24 5.24.96.04 1.27.05 3.71.05s2.75-.01 3.71-.05c3.31-.15 5.09-1.92 5.24-5.24.04-.96.05-1.27.05-3.71s-.01-2.75-.05-3.71C17.8 1.97 16.03.2 12.71.05 11.75.01 11.44 0 9 0zm0 4.38a4.62 4.62 0 100 9.24 4.62 4.62 0 000-9.24zM9 12a3 3 0 110-6 3 3 0 010 6zm4.81-8.88a1.08 1.08 0 10-.001 2.161A1.08 1.08 0 0013.81 3.12z" />
      </svg>
    ),
  },
];

export default function WebflowFooter() {
  return (
    <footer
      style={{
        backgroundColor: '#6A469D',
        padding: '50px 30px 15px',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Main footer content */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href={STC_BASE}>
              <Image
                src={LOGO_URL}
                alt="Acme Talent official color logo 2024"
                width={229}
                height={165}
                unoptimized
                className="w-auto"
                style={{ height: '165px' }}
              />
            </a>
          </div>

          {/* Link Columns */}
          <div className="grid grid-cols-3 gap-20">
            {COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col">
                <div
                  className="text-white text-[14px] font-bold mb-4"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {col.title}
                </div>
                {col.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-white text-[14px] leading-[16px] mb-[6px] hover:opacity-80 transition-opacity"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex items-center gap-4 mt-10">
          {SOCIALS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:opacity-70 transition-opacity"
              aria-label={social.label}
            >
              {social.icon}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div
          className="w-full"
          style={{
            height: '1px',
            backgroundColor: '#E4EBF3',
            margin: '70px 0 15px',
          }}
        />

        {/* Copyright */}
        <div
          className="text-white/70 text-[14px]"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          &copy; {new Date().getFullYear()} Acme Talent (formerly Chess at 3)
        </div>
      </div>
    </footer>
  );
}
