'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const STC_BASE = 'https://acmetalent.com';
const LOGO_URL = 'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/6849c92715d2914bcb05d69b_STC%20Logo%20COLOR%20CURRENT%202024.png';
const AMAZON_URL = 'https://acmetalent.com/shop';

type DropdownItem = { label: string; href: string };
type NavItem = { label: string; href: string } | { label: string; items: DropdownItem[] };

const MINI_NAV: (NavItem | { type: 'divider' })[] = [
  { label: 'Own a Franchise', href: 'https://franchising.acmetalent.com/' },
  { type: 'divider' },
  {
    label: 'In-School Programs',
    items: [
      { label: 'License Our Curriculum (Your Teachers Teach)', href: 'https://acmetalent.com/licensing' },
      { label: 'We Come To You! (Our Educators Teach)', href: `${STC_BASE}/school-partnerships` },
    ],
  },
  { type: 'divider' },
  { label: 'Shop our Game', href: AMAZON_URL },
];

const MAIN_NAV: NavItem[] = [
  { label: 'Home\nLessons', href: `${STC_BASE}/home-chess-lessons` },
  { label: 'Online\nLessons', href: `${STC_BASE}/online-chess-lessons` },
  {
    label: 'Locations',
    items: [
      { label: 'Park Slope', href: `${STC_BASE}/clubs-chess-lessons/park-slope-chess-club` },
      { label: 'Eastside', href: `${STC_BASE}/locations/fl/eastside` },
      { label: 'Westside', href: `${STC_BASE}/locations/tn/westside` },
    ],
  },
  {
    label: 'Camps',
    items: [
      { label: 'Holiday Camps', href: `${STC_BASE}/clubs-chess-lessons/nyc/holiday-camps` },
      { label: 'Summer Camp', href: `${STC_BASE}/clubs-chess-lessons/nyc/summer-camp` },
    ],
  },
  {
    label: 'About',
    items: [
      { label: 'About Us', href: `${STC_BASE}/about-us` },
      { label: 'Contact Us', href: `${STC_BASE}/contact-us` },
      { label: 'FAQs', href: `${STC_BASE}/faq` },
    ],
  },
];

function Dropdown({ label, items, small }: { label: string; items: DropdownItem[]; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        className="flex items-center gap-1 text-white hover:opacity-80 transition-opacity"
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: small ? '11px' : '14px',
          fontWeight: 600,
          lineHeight: small ? '20px' : '16px',
        }}
      >
        {label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg py-2 min-w-[240px] z-50"
          onMouseLeave={() => setOpen(false)}
        >
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="block px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 hover:text-[#1C9FDB] transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WebflowNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="w-full z-50"
      style={{ backgroundColor: '#1C9FDB', fontFamily: 'Poppins, sans-serif' }}
    >
      {/* Desktop Nav */}
      <div className="hidden lg:block">
        <div style={{ padding: '39px 0 0 0' }}>
          <div className="flex items-start justify-between">
            {/* Logo */}
            <a href={STC_BASE} className="flex-shrink-0 block" style={{ width: '290px', height: '180px' }}>
              <Image
                src={LOGO_URL}
                alt="Acme Talent official color logo 2024"
                width={250}
                height={180}
                unoptimized
                className="w-auto"
                style={{ height: '180px', marginLeft: '40px' }}
                priority
              />
            </a>

            {/* Nav Content */}
            <div className="flex flex-col" style={{ gap: '33px', marginRight: '40px' }}>
              {/* Mini Nav Row */}
              <div className="flex items-center justify-end" style={{ height: '30px', padding: '5px 0', gap: '20px' }}>
                {MINI_NAV.map((item, i) => {
                  if ('type' in item && item.type === 'divider') {
                    return (
                      <span key={i} className="text-white opacity-70 select-none" style={{ fontSize: '11px', lineHeight: '20px' }}>|</span>
                    );
                  }
                  const navItem = item as NavItem;
                  if ('items' in navItem) {
                    return <Dropdown key={navItem.label} label={navItem.label} items={navItem.items} small />;
                  }
                  const linkItem = navItem as { label: string; href: string };
                  return (
                    <a
                      key={linkItem.label}
                      href={linkItem.href}
                      className="text-white hover:opacity-80 transition-opacity"
                      style={{ fontFamily: 'Poppins, sans-serif', fontSize: '11px', fontWeight: 600, lineHeight: '20px' }}
                    >
                      {linkItem.label}
                    </a>
                  );
                })}
              </div>

              {/* Main Nav Row */}
              <div className="flex items-center" style={{ height: '52px', gap: '80px' }}>
                {MAIN_NAV.map((item) => {
                  if ('items' in item) {
                    return <Dropdown key={item.label} label={item.label} items={item.items} />;
                  }
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="text-white hover:opacity-80 transition-opacity block text-center"
                      style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px', fontWeight: 600, lineHeight: '16px' }}
                    >
                      {item.label.includes('\n') ? item.label.split('\n').map((line, li) => (
                        <span key={li}>{li > 0 && <br />}{line}</span>
                      )) : item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <a href={STC_BASE}>
            <Image
              src={LOGO_URL}
              alt="Acme Talent official color logo 2024"
              width={120}
              height={80}
              unoptimized
              className="h-12 w-auto"
              priority
            />
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-white p-2"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <XMarkIcon className="w-7 h-7" /> : <Bars3Icon className="w-7 h-7" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="bg-[#1889BC] border-t border-white/20 px-4 pb-6 pt-4 space-y-4">
            {MAIN_NAV.map((item) => {
              if ('items' in item) {
                return (
                  <div key={item.label}>
                    <div className="text-white text-[14px] font-medium mb-2">{item.label}</div>
                    <div className="pl-4 space-y-2">
                      {item.items.map((sub) => (
                        <a
                          key={sub.label}
                          href={sub.href}
                          className="block text-white/80 text-[13px] hover:text-white transition-colors"
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="block text-white text-[14px] font-medium hover:opacity-80"
                >
                  {item.label}
                </a>
              );
            })}
            <div className="border-t border-white/20 pt-4 space-y-2">
              {MINI_NAV.filter((item): item is NavItem => !('type' in item)).map((item) => {
                if ('items' in item) {
                  return item.items.map((sub) => (
                    <a
                      key={sub.label}
                      href={sub.href}
                      className="block text-white/80 text-[12px] hover:text-white transition-colors"
                    >
                      {sub.label}
                    </a>
                  ));
                }
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="block text-white/80 text-[12px] hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
