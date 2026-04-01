import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
  ClockIcon,
  CalendarIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const BRAND_LOGO_URL = 'https://placehold.co/200x60/3BA9DA/white?text=Acme+Talent';

interface PageProps {
  params: {
    username: string;
  };
}

const LOCATION_ICONS: Record<string, typeof PhoneIcon> = {
  PHONE: PhoneIcon,
  VIDEO: VideoCameraIcon,
  GOOGLE_MEET: VideoCameraIcon,
  ZOOM: VideoCameraIcon,
  IN_PERSON: MapPinIcon,
  CUSTOM: GlobeAltIcon,
};

const LOCATION_LABELS: Record<string, string> = {
  PHONE: 'Phone Call',
  VIDEO: 'Video Meeting',
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
  IN_PERSON: 'In Person',
  CUSTOM: 'Custom Location',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = params;
  const user = await prisma.user.findUnique({
    where: { schedulingUsername: username },
    select: { firstName: true, lastName: true },
  });

  if (!user) {
    return { title: 'Not Found' };
  }

  return {
    title: `Meet - ${user.firstName} ${user.lastName}`,
    description: `Schedule a meeting with ${user.firstName} ${user.lastName}`,
  };
}

export default async function UserSchedulePage({ params }: PageProps) {
  const { username } = params;

  // Find user by scheduling username
  const user = await prisma.user.findUnique({
    where: { schedulingUsername: username },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      schedulingUsername: true,
      profileImageUrl: true,
      organization: {
        select: { name: true },
      },
    },
  });

  if (!user) {
    notFound();
  }

  // Get user's active meeting types
  const meetingTypes = await prisma.meetingType.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    orderBy: { duration: 'asc' },
  });

  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-800 pb-28 sm:pb-32 pt-10 sm:pt-14">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-2xl mx-auto px-4 text-center">
          {/* Organization Logo */}
          <div className="mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO_URL}
              alt="Acme Talent"
              className="h-8 sm:h-10 mx-auto opacity-90"
            />
          </div>

          {/* Avatar */}
          {user.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.profileImageUrl}
              alt={`${user.firstName} ${user.lastName}`}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto ring-4 ring-white/20 shadow-2xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mx-auto ring-4 ring-white/20 shadow-2xl">
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-bold text-white mt-4 tracking-tight">{fullName}</h1>
          {user.organization && (
            <p className="text-purple-200/60 mt-1 text-xs sm:text-sm font-medium tracking-wide uppercase">{user.organization.name}</p>
          )}
        </div>
      </div>

      {/* Card — pulled up into the header with negative margin */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative z-10 pb-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/[0.08] border border-slate-200/60 overflow-hidden">
          <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-4 h-4 text-purple-500" />
              <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-slate-400">Select a meeting type</span>
            </div>
          </div>

          {meetingTypes.length === 0 ? (
            <div className="p-10 sm:p-12 text-center">
              <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-7 h-7 text-slate-300" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-4">No meeting types available</h3>
              <p className="text-sm text-slate-400 mt-1.5">
                This user hasn&apos;t set up any scheduling options yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80">
              {meetingTypes.map((type) => {
                const LocationIcon = LOCATION_ICONS[type.locationType] || GlobeAltIcon;
                const accentColor = type.color ?? '#7c3aed';

                return (
                  <Link
                    key={type.id}
                    href={`/meet/${username}/${type.slug}`}
                    className="block px-5 sm:px-6 py-4 sm:py-5 hover:bg-purple-50/40 active:bg-purple-50/60 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4">
                      {/* Color indicator + icon */}
                      <div
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                        style={{ backgroundColor: `${accentColor}12` }}
                      >
                        <LocationIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 group-hover:text-purple-700 transition-colors text-[15px]">
                          {type.name}
                        </h3>
                        {type.description && (
                          <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">
                            {type.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2.5 sm:gap-3 mt-1.5 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {type.duration} min
                          </span>
                          <span className="text-slate-300">|</span>
                          <span>{LOCATION_LABELS[type.locationType]}</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-purple-100 flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0">
                        <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-6 pb-4">
          <p className="text-xs text-slate-300">
            Powered by{' '}
            <Link href="/" className="text-slate-400 hover:text-purple-600 transition-colors font-medium">
              Acme Talent
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
