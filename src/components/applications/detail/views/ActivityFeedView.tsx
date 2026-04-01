'use client';

import { useState, useEffect } from 'react';
import {
  EnvelopeIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftIcon,
  CalendarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow, format } from 'date-fns';

type Activity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

type Props = {
  applicationId: string;
};

export function ActivityFeedView({ applicationId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch(`/api/applications/${applicationId}/activity`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
  }, [applicationId]);

  const toggleEmailExpanded = (id: string) => {
    setExpandedEmails(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Map activities to timeline items
  const timelineItems = activities.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    timestamp: a.createdAt,
    user: a.user,
    isEmail: a.type === 'EMAIL_SENT',
    metadata: a.metadata,
  }));

  // Filter and sort
  const filteredItems = timelineItems
    .filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'EMAIL_SENT':
        return EnvelopeIcon;
      case 'STAGE_CHANGE':
        return ArrowsRightLeftIcon;
      case 'NOTE_ADDED':
        return ChatBubbleLeftIcon;
      case 'INTERVIEW_SCHEDULED':
      case 'INTERVIEW_COMPLETED':
        return CalendarIcon;
      case 'OFFER_CREATED':
      case 'OFFER_SENT':
      case 'OFFER_ACCEPTED':
      case 'OFFER_DECLINED':
        return DocumentTextIcon;
      case 'TASK_COMPLETED':
        return CheckCircleIcon;
      case 'APPLICATION_CREATED':
        return BoltIcon;
      default:
        return BoltIcon;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'EMAIL_SENT':
        return 'bg-cyan-100 text-cyan-600';
      case 'STAGE_CHANGE':
        return 'bg-purple-100 text-purple-600';
      case 'NOTE_ADDED':
        return 'bg-gray-100 text-gray-600';
      case 'INTERVIEW_SCHEDULED':
      case 'INTERVIEW_COMPLETED':
        return 'bg-success-100 text-success-600';
      case 'OFFER_CREATED':
      case 'OFFER_SENT':
        return 'bg-warning-100 text-warning-600';
      case 'OFFER_ACCEPTED':
        return 'bg-success-100 text-success-600';
      case 'OFFER_DECLINED':
        return 'bg-danger-100 text-danger-600';
      case 'APPLICATION_CREATED':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          />
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          >
            <option value="newest">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {/* Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          >
            <option value="all">All activity types</option>
            <option value="EMAIL_SENT">Emails</option>
            <option value="STAGE_CHANGE">Stage changes</option>
            <option value="NOTE_ADDED">Notes</option>
            <option value="INTERVIEW_SCHEDULED">Interviews</option>
            <option value="OFFER_CREATED">Offers</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading activity...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No activity found</div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const Icon = getActivityIcon(item.type);
            const colorClass = getActivityColor(item.type);
            const isExpanded = expandedEmails.has(item.id);
            const emailBody = item.metadata?.body as string | undefined;
            const emailHtmlBody = item.metadata?.htmlBody as string | undefined;
            const emailTo = item.metadata?.to as string | undefined;
            const emailSubject = item.metadata?.subject as string | undefined;
            const emailOpenedAt = item.metadata?.openedAt as string | undefined;
            const emailClickedAt = item.metadata?.clickedAt as string | undefined;
            const emailStatus = item.metadata?.status as string | undefined;

            return (
              <div key={item.id} className="flex gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {item.isEmail ? 'Email' : formatActivityType(item.type)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(item.timestamp), 'MMM d, yyyy')} at {format(new Date(item.timestamp), 'h:mma').toLowerCase()}
                    </span>
                  </div>

                  {/* Email-specific display (Greenhouse style) */}
                  {item.isEmail ? (
                    <div className="mt-2 space-y-1">
                      {emailTo && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">To: </span>
                          <span className="text-gray-600">{emailTo}</span>
                        </div>
                      )}
                      {emailSubject && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Subject: </span>
                          <span className="text-gray-600">{emailSubject}</span>
                        </div>
                      )}
                      {/* Email tracking indicators */}
                      <div className="flex items-center gap-3 mt-1.5">
                        {emailStatus === 'BOUNCED' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger-500" />
                            Bounced
                          </span>
                        ) : (
                          <>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              emailOpenedAt
                                ? 'text-success-700 bg-success-50'
                                : 'text-gray-500 bg-gray-100'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${emailOpenedAt ? 'bg-success-500' : 'bg-gray-300'}`} />
                              {emailOpenedAt
                                ? `Opened ${format(new Date(emailOpenedAt), 'MMM d, h:mma').toLowerCase()}`
                                : 'Not opened'}
                            </span>
                            {emailClickedAt && (
                              <span className="inline-flex items-center gap-1 text-xs text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                Clicked {format(new Date(emailClickedAt), 'MMM d, h:mma').toLowerCase()}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {(emailBody || emailHtmlBody) && (
                        <div className="mt-3">
                          {isExpanded && emailHtmlBody ? (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <iframe
                                srcDoc={emailHtmlBody}
                                sandbox=""
                                className="w-full border-0"
                                style={{ minHeight: '400px' }}
                                onLoad={(e) => {
                                  const iframe = e.target as HTMLIFrameElement;
                                  if (iframe.contentDocument?.body) {
                                    iframe.style.height = `${iframe.contentDocument.body.scrollHeight + 20}px`;
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                              {emailBody}
                            </p>
                          )}
                          <button
                            onClick={() => toggleEmailExpanded(item.id)}
                            className="text-sm text-brand-purple hover:underline mt-2 flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUpIcon className="w-4 h-4" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDownIcon className="w-4 h-4" />
                                {emailHtmlBody ? 'View email' : 'Read more'}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{item.title}</p>
                      {item.description && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>
                        </div>
                      )}
                      {item.user && (
                        <p className="text-xs text-gray-500 mt-1">
                          by {item.user.firstName} {item.user.lastName}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
