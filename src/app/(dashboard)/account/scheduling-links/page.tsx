'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LinkIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface MeetingType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: number;
  color: string;
  isActive: boolean;
  locationType: 'PHONE' | 'VIDEO' | 'IN_PERSON' | 'CUSTOM';
  googleMeetEnabled: boolean;
  zoomEnabled: boolean;
}

interface ProfileData {
  schedulingUsername: string | null;
}

const LOCATION_ICONS = {
  PHONE: PhoneIcon,
  VIDEO: VideoCameraIcon,
  IN_PERSON: MapPinIcon,
  CUSTOM: GlobeAltIcon,
};

const LOCATION_LABELS = {
  PHONE: 'Phone Call',
  VIDEO: 'Video Call',
  IN_PERSON: 'In Person',
  CUSTOM: 'Custom',
};

export default function SchedulingLinksPage() {
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [typesRes, profileRes] = await Promise.all([
          fetch('/api/scheduling/meeting-types'),
          fetch('/api/account/profile'),
        ]);

        if (typesRes.ok) {
          const types = await typesRes.json();
          setMeetingTypes(types);
        }

        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const copyLink = (meetingType: MeetingType) => {
    if (!profile?.schedulingUsername) return;
    const url = `${window.location.origin}/meet/${profile.schedulingUsername}/${meetingType.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(meetingType.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSchedulingUrl = (meetingType: MeetingType) => {
    if (!profile?.schedulingUsername) return null;
    return `/meet/${profile.schedulingUsername}/${meetingType.slug}`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-64 bg-slate-200 rounded" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const hasUsername = !!profile?.schedulingUsername;

  return (
    <div className="divide-y divide-slate-100">
      {/* Header */}
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center flex-shrink-0">
            <LinkIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">Scheduling Links</h2>
            <p className="text-sm text-slate-500 mt-1">
              Share your meeting links so others can book time with you
            </p>
          </div>
          <Link
            href="/configure/scheduling/meeting-types/new"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-200 hover:from-purple-700 hover:to-purple-800 transition-all"
          >
            <PlusIcon className="w-4 h-4" />
            New Meeting Type
          </Link>
        </div>
      </div>

      {/* Username Warning */}
      {!hasUsername && (
        <div className="p-6 sm:p-8">
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-warning-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center flex-shrink-0">
                <LinkIcon className="w-5 h-5 text-warning-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-warning-800">Set up your scheduling URL</h3>
                <p className="text-sm text-warning-700 mt-1">
                  Create a personal username to generate shareable scheduling links.
                </p>
                <Link
                  href="/account"
                  className="inline-flex items-center gap-1 text-sm font-medium text-warning-700 hover:text-warning-800 mt-3"
                >
                  Set up username
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Types List */}
      <div className="p-6 sm:p-8">
        {meetingTypes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <LinkIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mt-4">No meeting types yet</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">
              Create your first meeting type to start sharing scheduling links.
            </p>
            <Link
              href="/configure/scheduling/meeting-types/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-purple-200 hover:from-purple-700 hover:to-purple-800 transition-all mt-6"
            >
              <PlusIcon className="w-4 h-4" />
              Create Meeting Type
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {meetingTypes.map((type) => {
              const LocationIcon = LOCATION_ICONS[type.locationType] || GlobeAltIcon;
              const url = getSchedulingUrl(type);
              const isCopied = copiedId === type.id;

              return (
                <div
                  key={type.id}
                  className={`
                    relative overflow-hidden rounded-xl border-2 transition-all duration-200
                    ${type.isActive
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-slate-100 bg-slate-50 opacity-60'
                    }
                  `}
                >
                  {/* Color Indicator */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: type.color }}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 pl-6">
                    {/* Meeting Type Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${type.color}15` }}
                      >
                        <LocationIcon className="w-6 h-6" style={{ color: type.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 truncate">{type.name}</h3>
                          {!type.isActive && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span>{type.duration} min</span>
                          <span className="text-slate-300">•</span>
                          <span>{LOCATION_LABELS[type.locationType]}</span>
                          {type.googleMeetEnabled && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-success-600">Google Meet</span>
                            </>
                          )}
                          {type.zoomEnabled && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-cyan-600">Zoom</span>
                            </>
                          )}
                        </div>
                        {hasUsername && url && (
                          <p className="text-xs text-slate-400 font-mono mt-2 truncate">
                            {window.location.origin}{url}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      {hasUsername && type.isActive && (
                        <>
                          <Link
                            href={url || '#'}
                            target="_blank"
                            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => copyLink(type)}
                            className={`
                              flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                              ${isCopied
                                ? 'bg-success-100 text-success-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }
                            `}
                          >
                            {isCopied ? (
                              <>
                                <ClipboardDocumentCheckIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Copied!</span>
                              </>
                            ) : (
                              <>
                                <ClipboardDocumentIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Copy Link</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                      <Link
                        href={`/configure/scheduling/meeting-types?edit=${type.id}`}
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile Add Button */}
      <div className="p-6 sm:hidden">
        <Link
          href="/configure/scheduling/meeting-types/new"
          className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-purple-200"
        >
          <PlusIcon className="w-5 h-5" />
          New Meeting Type
        </Link>
      </div>
    </div>
  );
}
