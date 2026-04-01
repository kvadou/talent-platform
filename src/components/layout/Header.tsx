'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  PlusIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  BriefcaseIcon,
  UserPlusIcon,
  XMarkIcon,
  Bars3Icon,
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { MarketSelector, MarketOption } from './MarketSelector';

type SearchResults = {
  candidates: { id: string; firstName: string; lastName: string; email: string }[];
  jobs: { id: string; title: string; status: string; market: { name: string } }[];
  applications: {
    id: string;
    status: string;
    candidate: { firstName: string; lastName: string };
    job: { title: string };
    stage: { name: string };
  }[];
};

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 p-0.5 border border-white/20"
      >
        {session?.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || 'Profile'}
            width={36}
            height={36}
            unoptimized
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover"
          />
        ) : (
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
          </div>

          {/* Menu items */}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
          >
            <UserCircleIcon className="w-5 h-5" />
            <span className="font-medium">Account Settings</span>
          </Link>

          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: '/login' });
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-danger-50 hover:text-danger-700 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({
  markets,
  currentMarketId,
  onMarketChange = () => {}
}: {
  markets: MarketOption[];
  currentMarketId?: string;
  onMarketChange?: (id: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAddDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu and mobile search on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu or mobile search is open
  useEffect(() => {
    if (mobileMenuOpen || mobileSearchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, mobileSearchOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear search and close on navigation
  const handleSearchSelect = useCallback((href: string) => {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    router.push(href as any);
  }, [router]);

  const hasResults = searchResults && (
    searchResults.candidates.length > 0 ||
    searchResults.jobs.length > 0 ||
    searchResults.applications.length > 0
  );

  const isActive = (path: string) => {
    if (path === '/jobs') return pathname === '/jobs' || pathname.startsWith('/jobs/');
    if (path === '/candidates') return pathname === '/candidates' || pathname.startsWith('/candidates/');
    return pathname === path;
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    { href: '/jobs', label: 'Jobs', icon: BriefcaseIcon },
    { href: '/candidates', label: 'Candidates', icon: UsersIcon },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 text-white z-50">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700" />
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-yellow-500/10" />
        <div className="absolute inset-0 bg-noise opacity-20" />
        <div className="absolute inset-0 backdrop-blur-sm bg-gradient-to-b from-black/5 to-black/10" />

        {/* Left side - Hamburger (mobile) / Nav (desktop) */}
        <div className="relative flex items-center gap-2 sm:gap-3 z-10">
          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Open menu"
          >
            <Bars3Icon className="w-6 h-6 text-white" />
          </button>

          {/* Desktop Market Selector */}
          <div className="hidden lg:flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-md px-3 py-1.5 text-sm border border-white/20">
            <MarketSelector markets={markets} value={currentMarketId} onChange={onMarketChange} />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Add Dropdown */}
          <div className="hidden sm:block relative" ref={dropdownRef}>
            <button
              onClick={() => setAddDropdownOpen(!addDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-purple-700 rounded-lg text-sm font-semibold hover:bg-white/90 active:scale-95 transition-all duration-200 shadow-lg"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${addDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {addDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Link
                  href="/candidates/new"
                  onClick={() => setAddDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                >
                  <UserPlusIcon className="w-5 h-5" />
                  <span className="font-medium">Add Candidate</span>
                </Link>
                <Link
                  href="/jobs/new"
                  onClick={() => setAddDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                >
                  <BriefcaseIcon className="w-5 h-5" />
                  <span className="font-medium">Create Job</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Center Logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <Link href="/dashboard" className="block group">
            <Image
              src="/logo.png"
              alt="Acme Talent"
              width={72}
              height={72}
              className="h-12 w-12 sm:h-[68px] sm:w-[68px] object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
        </div>

        {/* Right side - Actions */}
        <div className="relative flex items-center gap-1.5 sm:gap-2 z-10">
          {/* Mobile Search Button */}
          <button
            onClick={() => setMobileSearchOpen(true)}
            className="sm:hidden p-2 rounded-lg bg-white/10 backdrop-blur-md hover:bg-white/20 active:bg-white/30 transition-all duration-200 border border-white/20"
            aria-label="Search"
          >
            <MagnifyingGlassIcon className="w-5 h-5 text-white" />
          </button>

          {/* Search - Desktop only */}
          <div className="hidden sm:block relative" ref={searchRef}>
            {searchOpen ? (
              <div className="relative">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 px-3 py-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                  <MagnifyingGlassIcon className="w-4 h-4 text-white/70" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidates, jobs..."
                    autoFocus
                    className="bg-transparent text-white placeholder-white/50 text-sm w-56 sm:w-72 focus:outline-none"
                  />
                  {searchLoading && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <button
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="p-0.5 hover:bg-white/10 rounded"
                  >
                    <XMarkIcon className="w-4 h-4 text-white/70" />
                  </button>
                </div>

                {/* Search Results Dropdown */}
                {searchQuery.trim().length >= 2 && (hasResults || searchLoading) && (
                  <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                    {searchLoading && !hasResults ? (
                      <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                    ) : hasResults ? (
                      <div className="max-h-96 overflow-y-auto">
                        {/* Candidates */}
                        {searchResults!.candidates.length > 0 && (
                          <div>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                              <UsersIcon className="w-3.5 h-3.5" />
                              Candidates
                            </div>
                            {searchResults!.candidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                onClick={() => handleSearchSelect(`/candidates/${candidate.id}`)}
                                className="w-full px-3 py-2 text-left hover:bg-purple-50 transition-colors flex items-center gap-3"
                              >
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-medium">
                                  {candidate.firstName[0]}{candidate.lastName[0]}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {candidate.firstName} {candidate.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">{candidate.email}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Jobs */}
                        {searchResults!.jobs.length > 0 && (
                          <div>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                              <BriefcaseIcon className="w-3.5 h-3.5" />
                              Jobs
                            </div>
                            {searchResults!.jobs.map((job) => (
                              <button
                                key={job.id}
                                onClick={() => handleSearchSelect(`/jobs/${job.id}/pipeline`)}
                                className="w-full px-3 py-2 text-left hover:bg-purple-50 transition-colors flex items-center gap-3"
                              >
                                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                                  <BriefcaseIcon className="w-4 h-4 text-cyan-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{job.title}</div>
                                  <div className="text-xs text-gray-500">
                                    {job.market.name} · {job.status}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Applications */}
                        {searchResults!.applications.length > 0 && (
                          <div>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                              <DocumentTextIcon className="w-3.5 h-3.5" />
                              Applications
                            </div>
                            {searchResults!.applications.map((app) => (
                              <button
                                key={app.id}
                                onClick={() => handleSearchSelect(`/applications/${app.id}`)}
                                className="w-full px-3 py-2 text-left hover:bg-purple-50 transition-colors flex items-center gap-3"
                              >
                                <div className="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center">
                                  <DocumentTextIcon className="w-4 h-4 text-success-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {app.candidate.firstName} {app.candidate.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {app.job.title} · {app.stage.name}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* No Results */}
                    {!searchLoading && searchResults && !hasResults && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No results found for &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 sm:p-2.5 rounded-lg bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 border border-white/20"
              >
                <MagnifyingGlassIcon className="w-5 h-5 text-white" />
              </button>
            )}
          </div>

          {/* Configure Button - Desktop only */}
          <Link
            href="/configure/organization"
            className={`hidden sm:flex p-2 sm:p-2.5 rounded-lg transition-all duration-200 border border-white/20 ${
              pathname.startsWith('/configure')
                ? 'bg-white/25 shadow-sm'
                : 'bg-white/10 backdrop-blur-md hover:bg-white/20'
            }`}
          >
            <Cog6ToothIcon className="w-5 h-5 text-white" />
          </Link>

          {/* Profile */}
          <UserMenu />
        </div>

        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-out Menu */}
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 p-1.5">
                  <Image
                    src="/logo.png"
                    alt="Acme Talent"
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="font-semibold text-gray-900">Menu</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Market Selector */}
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Market</p>
              <div className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-200">
                <MarketSelector markets={markets} value={currentMarketId} onChange={onMarketChange} />
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href as never}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                      isActive(link.href)
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Quick Actions */}
            <div className="p-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Quick Actions</p>
              <div className="space-y-2">
                <Link
                  href="/candidates/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
                >
                  <UserPlusIcon className="w-5 h-5" />
                  Add Candidate
                </Link>
                <Link
                  href="/jobs/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  <BriefcaseIcon className="w-5 h-5" />
                  Create Job
                </Link>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname.startsWith('/account')
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <UserCircleIcon className="w-5 h-5" />
                  Account
                </Link>
                <Link
                  href="/configure/organization"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname.startsWith('/configure')
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Search Overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[70] sm:hidden">
          {/* Full-screen white background */}
          <div className="absolute inset-0 bg-white">
            {/* Header with search input */}
            <div className="flex items-center gap-3 p-3 border-b border-gray-200 bg-purple-600">
              <button
                onClick={() => {
                  setMobileSearchOpen(false);
                  setSearchQuery('');
                  setSearchResults(null);
                }}
                className="p-2 -ml-1 rounded-lg text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                aria-label="Close search"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-4 py-3">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidates, jobs..."
                  autoFocus
                  className="flex-1 bg-transparent text-gray-900 placeholder-gray-500 text-base focus:outline-none"
                  style={{ fontSize: '16px' }} // Prevent iOS zoom
                />
                {searchLoading && (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin flex-shrink-0" />
                )}
                {searchQuery && !searchLoading && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {searchQuery.trim().length < 2 ? (
                <div className="p-6 text-center">
                  <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Type at least 2 characters to search</p>
                </div>
              ) : searchLoading && !hasResults ? (
                <div className="p-6 text-center">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Searching...</p>
                </div>
              ) : hasResults ? (
                <div className="divide-y divide-gray-100">
                  {/* Candidates */}
                  {searchResults!.candidates.length > 0 && (
                    <div>
                      <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 sticky top-0">
                        <UsersIcon className="w-4 h-4" />
                        Candidates ({searchResults!.candidates.length})
                      </div>
                      {searchResults!.candidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => handleSearchSelect(`/candidates/${candidate.id}`)}
                          className="w-full px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-4"
                        >
                          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-base font-semibold flex-shrink-0">
                            {candidate.firstName[0]}{candidate.lastName[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-medium text-gray-900 truncate">
                              {candidate.firstName} {candidate.lastName}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{candidate.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Jobs */}
                  {searchResults!.jobs.length > 0 && (
                    <div>
                      <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 sticky top-0">
                        <BriefcaseIcon className="w-4 h-4" />
                        Jobs ({searchResults!.jobs.length})
                      </div>
                      {searchResults!.jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => handleSearchSelect(`/jobs/${job.id}/pipeline`)}
                          className="w-full px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-4"
                        >
                          <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                            <BriefcaseIcon className="w-6 h-6 text-cyan-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-medium text-gray-900 truncate">{job.title}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {job.market.name} · {job.status}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Applications */}
                  {searchResults!.applications.length > 0 && (
                    <div>
                      <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 sticky top-0">
                        <DocumentTextIcon className="w-4 h-4" />
                        Applications ({searchResults!.applications.length})
                      </div>
                      {searchResults!.applications.map((app) => (
                        <button
                          key={app.id}
                          onClick={() => handleSearchSelect(`/applications/${app.id}`)}
                          className="w-full px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-4"
                        >
                          <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center flex-shrink-0">
                            <DocumentTextIcon className="w-6 h-6 text-success-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-medium text-gray-900 truncate">
                              {app.candidate.firstName} {app.candidate.lastName}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                              {app.job.title} · {app.stage.name}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : searchResults && !hasResults ? (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <MagnifyingGlassIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-medium mb-1">No results found</p>
                  <p className="text-gray-500 text-sm">Try a different search term</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
