'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  UserGroupIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import WebflowNavbar from '@/components/public/WebflowNavbar';
import WebflowFooter from '@/components/public/WebflowFooter';

type Job = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employmentType?: string;
  market: {
    slug: string;
    name: string;
  };
};

// Asset URLs
const ASSETS = {
  logo: 'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/6849c92715d2914bcb05d69b_STC%20Logo%20COLOR%20CURRENT%202024.png',
  video: 'https://www.youtube.com/embed/JZvz42dKFl4',
  gallery: [
    'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/68484ceb4053183a873980e3_Commited2.jpg',
    'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/68484ceb4053183a87398026_unnamed%20(1)%20(1).png',
    'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/68484ceb4053183a87397fad_IMG_0452%20(1).jpg',
    'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/68484ceb4053183a87397fac_F80A7789.jpg',
    'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/68484ceb4053183a87397f48_62%20(1).jpg',
  ],
};

// Impact stats
const STATS = [
  { number: '50,000+', label: 'Kids Taught', icon: AcademicCapIcon },
  { number: '500+', label: 'Schools & Partners', icon: GlobeAltIcon },
  { number: '6', label: 'Countries', icon: MapPinIcon },
  { number: '200+', label: 'Team Members', icon: UserGroupIcon },
];



// Floating shape component
function FloatingShape({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <div
      className={`absolute rounded-full opacity-20 animate-float-shapes ${className}`}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  return { count, ref };
}

// Stat card component
function StatCard({ stat, index }: { stat: typeof STATS[0]; index: number }) {
  const numericValue = parseInt(stat.number.replace(/[^0-9]/g, ''));
  const suffix = stat.number.replace(/[0-9]/g, '');
  const { count, ref } = useCounter(numericValue);
  const Icon = stat.icon;

  return (
    <div
      ref={ref}
      className="text-center group"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4 group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
        <Icon className="w-8 h-8 text-white" />
      </div>
      <div className="text-4xl md:text-5xl font-bold text-white mb-2">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-white/80 font-medium">{stat.label}</div>
    </div>
  );
}

export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch('/api/public/jobs');
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error('Failed to load jobs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);


  // Get unique locations for filter
  const locations = ['all', ...new Set(jobs.map(j => {
    if (!j.location) return 'Remote';
    if (j.location.includes('Singapore')) return 'Singapore';
    if (j.location.includes('New York') || j.location.includes('NYC') || j.location.includes('Brooklyn')) return 'New York';
    if (j.location.includes('Eastside') || j.location.includes('Florida')) return 'Florida';
    if (j.location.includes('LA') || j.location.includes('Los Angeles')) return 'Los Angeles';
    if (j.location.includes('Remote')) return 'Remote';
    return j.location.split(',')[0];
  }))];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase()));

    if (locationFilter === 'all') return matchesSearch;

    const jobLocation = job.location || 'Remote';
    return matchesSearch && jobLocation.toLowerCase().includes(locationFilter.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Webflow-matched Navbar */}
      <WebflowNavbar />

      {/* Hero Section */}
      <section className="relative min-h-[35vh] flex items-center justify-center overflow-hidden py-12">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-[#1C9FDB]" />

        {/* Animated Shapes */}
        {/* Queen Bella bubble */}
        <div
          className="absolute w-32 h-32 top-20 left-10 rounded-full overflow-hidden opacity-80 animate-float-shapes shadow-lg"
          style={{ animationDelay: '0s' }}
        >
          <img
            src="/images/queen-bella-bubble.png"
            alt="Queen Bella"
            className="w-full h-full object-contain"
          />
        </div>
        <FloatingShape className="w-24 h-24 bg-[#F5D547] top-40 right-20" delay={1} />
        <FloatingShape className="w-40 h-40 bg-[#E8837B] bottom-32 left-1/4" delay={2} />
        <FloatingShape className="w-20 h-20 bg-white bottom-20 right-1/3" delay={0.5} />
        {/* Queen Bella bubble (right) */}
        <div
          className="absolute w-28 h-28 top-1/3 right-10 rounded-full overflow-hidden opacity-80 animate-float-shapes shadow-lg"
          style={{ animationDelay: '1.5s' }}
        >
          <img
            src="/images/queen-bella-bubble-right.png"
            alt="Queen Bella"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 opacity-0 animate-fade-in-up">
            Join Our Story
          </h1>
          <div className="max-w-2xl mx-auto mb-8 opacity-0 animate-reveal-1 space-y-3">
            <p className="text-lg md:text-xl text-white/90">
              <span className="font-semibold">Mission:</span> We invite all children to experience the profound benefits of chess through stories.
            </p>
            <p className="text-lg md:text-xl text-white/90">
              <span className="font-semibold">Vision:</span> Help us impact children and reach 1 million good game handshakes with our students.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center opacity-0 animate-reveal-2">
            <a
              href="#openings"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#3BA9DA] font-bold rounded-full hover:bg-[#F5D547] hover:text-[#2D3E6F] transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              View Open Roles
              <ArrowRightIcon className="w-5 h-5" />
            </a>
            <button
              onClick={() => setShowVideo(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-bold rounded-full border-2 border-white/30 hover:bg-white/20 transition-all duration-300"
            >
              <PlayIcon className="w-5 h-5" />
              See Our Impact
            </button>
          </div>
        </div>

      </section>

      {/* Video Modal */}
      {showVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowVideo(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${ASSETS.video}?autoplay=1&rel=0&modestbranding=1&showinfo=0&controls=1&fs=1&iv_load_policy=3`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setShowVideo(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stats Section */}
      <section className="relative py-20 bg-[#2D3E6F]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {STATS.map((stat, i) => (
              <StatCard key={i} stat={stat} index={i} />
            ))}
          </div>
        </div>
      </section>


      {/* Job Listings Section */}
      <section id="openings" className="py-24 bg-[#E5F4F8]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#2D3E6F] mb-4">
              Open Positions
            </h2>
            <p className="text-xl text-gray-600">
              Find your perfect role and start making a difference
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search roles..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#3BA9DA] focus:border-transparent transition-all"
                />
              </div>

              {/* Location Filter */}
              <div className="relative">
                <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="appearance-none pl-12 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#3BA9DA] focus:border-transparent bg-white cursor-pointer min-w-[180px]"
                >
                  <option value="all">All Locations</option>
                  {locations.filter(l => l !== 'all').map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                <ChevronDownIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              <span className="font-bold text-[#2D3E6F] text-2xl">{filteredJobs.length}</span>
              {' '}position{filteredJobs.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {/* Job Cards */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-12 h-12 border-4 border-[#3BA9DA]/30 border-t-[#3BA9DA] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map((job, i) => (
                <Link
                  key={job.id}
                  href={`/careers/${job.id}`}
                  className="group bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#3BA9DA]/30"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3BA9DA]/10 to-[#7C3AED]/10 flex items-center justify-center">
                          <BriefcaseIcon className="w-5 h-5 text-[#3BA9DA]" />
                        </div>
                        <h3 className="text-lg font-bold text-[#2D3E6F] group-hover:text-[#3BA9DA] transition-colors">
                          {job.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        {job.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />
                            {job.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#E5F4F8] rounded-full text-[#3BA9DA] font-medium">
                          {job.market.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[#3BA9DA] font-semibold group-hover:gap-4 transition-all">
                      Apply Now
                      <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}

              {filteredJobs.length === 0 && !loading && (
                <div className="text-center py-16 bg-white rounded-2xl">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MagnifyingGlassIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg">No positions found matching your criteria.</p>
                  <button
                    onClick={() => { setSearchTerm(''); setLocationFilter('all'); }}
                    className="mt-4 text-[#3BA9DA] font-semibold hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>


      {/* Photo Gallery */}
      <section className="py-16 bg-[#3BA9DA] overflow-hidden">
        <div className="flex gap-4 animate-marquee hover:[animation-play-state:paused]">
          {[...ASSETS.gallery, ...ASSETS.gallery].map((src, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
            >
              <Image
                src={src}
                alt={`Team photo ${(i % ASSETS.gallery.length) + 1}`}
                width={256}
                height={256}
                unoptimized
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-[#2D3E6F] to-[#7C3AED]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Don&apos;t See Your Dream Role?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            We&apos;re always looking for talented people. Send us your resume and let us know how you&apos;d like to contribute to our mission.
          </p>
          <a
            href="https://mail.google.com/mail/?view=cm&to=recruiting@acmetalent.com&su=General+Interest+-+Acme+Talent"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-[#7C3AED] font-bold rounded-full hover:bg-[#F5D547] hover:text-[#2D3E6F] transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 text-lg"
          >
            Get In Touch
            <ArrowRightIcon className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Webflow-matched Footer */}
      <WebflowFooter />
    </div>
  );
}
