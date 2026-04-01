'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  VideoCameraIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { InterviewKitEditor } from '@/components/interview-kits/InterviewKitEditor';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type InterviewKit = {
  id: string;
  name: string;
  type: string;
  duration: number;
  includesAudition: boolean;
  order: number;
  stage: { id: string; name: string; order: number } | null;
  prepItems: Array<{
    id: string;
    title: string;
    description: string | null;
    duration: number | null;
    order: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    order: number;
    attributes: Array<{
      id: string;
      name: string;
      description: string | null;
      required: boolean;
      order: number;
    }>;
  }>;
};

type Stage = {
  id: string;
  name: string;
  order: number;
};

const interviewTypeIcons: Record<string, typeof PhoneIcon> = {
  PHONE_SCREEN: PhoneIcon,
  VIDEO_INTERVIEW: VideoCameraIcon,
  VIDEO_INTERVIEW_AUDITION: VideoCameraIcon,
  IN_PERSON: BuildingOfficeIcon,
  ONSITE: BuildingOfficeIcon,
  TECHNICAL_INTERVIEW: VideoCameraIcon,
  BEHAVIORAL_INTERVIEW: VideoCameraIcon,
  FINAL_INTERVIEW: BuildingOfficeIcon,
};

const interviewTypeLabels: Record<string, string> = {
  PHONE_SCREEN: 'Phone Screen',
  VIDEO_INTERVIEW: 'Video Interview',
  VIDEO_INTERVIEW_AUDITION: 'Video Interview + Audition',
  IN_PERSON: 'In-Person',
  ONSITE: 'Onsite',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  BEHAVIORAL_INTERVIEW: 'Behavioral Interview',
  FINAL_INTERVIEW: 'Final Interview',
};

export default function InterviewKitsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [interviewKits, setInterviewKits] = useState<InterviewKit[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [editingKit, setEditingKit] = useState<InterviewKit | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteKitId, setPendingDeleteKitId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [kitsRes, stagesRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/interview-kits`),
        fetch(`/api/jobs/${jobId}/stages`),
      ]);

      const kitsData = await kitsRes.json();
      const stagesData = await stagesRes.json();

      setInterviewKits(kitsData.interviewKits || []);
      setStages(stagesData.stages || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpanded = (kitId: string) => {
    setExpandedKits((prev) => {
      const next = new Set(prev);
      if (next.has(kitId)) {
        next.delete(kitId);
      } else {
        next.add(kitId);
      }
      return next;
    });
  };

  const initiateDelete = (kitId: string) => {
    setPendingDeleteKitId(kitId);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async (kitId: string) => {
    try {
      await fetch(`/api/jobs/${jobId}/interview-kits/${kitId}`, {
        method: 'DELETE',
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to delete kit:', error);
    }
  };

  const handleSave = async () => {
    setEditingKit(null);
    setIsCreating(false);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (editingKit || isCreating) {
    return (
      <InterviewKitEditor
        jobId={jobId}
        kit={editingKit}
        stages={stages}
        onSave={handleSave}
        onCancel={() => {
          setEditingKit(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/jobs/${jobId}/setup`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Interview Kits</h1>
            <p className="text-gray-500 mt-1">
              Configure interview prep guides and scorecards for each interview type
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          Add Interview Kit
        </button>
      </div>

      {/* Interview Kits List */}
      {interviewKits.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Interview Kits</h3>
          <p className="text-gray-500 mb-6">
            Create interview kits to standardize your interview process with prep guides and scorecards.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Create First Kit
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {interviewKits.map((kit) => {
            const Icon = interviewTypeIcons[kit.type] || VideoCameraIcon;
            const isExpanded = expandedKits.has(kit.id);
            const attributeCount = kit.categories.reduce(
              (sum, cat) => sum + cat.attributes.length,
              0
            );

            return (
              <div
                key={kit.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Kit Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpanded(kit.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-brand-purple/10 rounded-lg">
                      <Icon className="w-6 h-6 text-brand-purple" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{kit.name}</h3>
                        {kit.includesAudition && (
                          <span className="px-2 py-0.5 bg-warning-100 text-warning-700 text-xs font-medium rounded">
                            + Audition
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{interviewTypeLabels[kit.type] || kit.type}</span>
                        <span>·</span>
                        <span>{kit.duration} min</span>
                        {kit.stage && (
                          <>
                            <span>·</span>
                            <span>Stage: {kit.stage.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{kit.prepItems.length} prep items</span>
                      <span>{attributeCount} attributes</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingKit(kit)}
                        className="p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => initiateDelete(kit.id)}
                        className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Prep Items */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <DocumentTextIcon className="w-4 h-4" />
                          Interview Prep
                        </h4>
                        {kit.prepItems.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">No prep items configured</p>
                        ) : (
                          <ul className="space-y-2">
                            {kit.prepItems.map((item) => (
                              <li key={item.id} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-brand-purple rounded-full mt-2 flex-shrink-0" />
                                <div>
                                  <span className="text-sm text-gray-700">{item.title}</span>
                                  {item.duration && (
                                    <span className="text-xs text-gray-400 ml-2">
                                      ({item.duration} min)
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Scorecard Categories */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <ClipboardDocumentListIcon className="w-4 h-4" />
                          Scorecard
                        </h4>
                        {kit.categories.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">No scorecard configured</p>
                        ) : (
                          <div className="space-y-3">
                            {kit.categories.map((category) => (
                              <div key={category.id}>
                                <h5 className="text-sm font-medium text-gray-600">
                                  {category.name}
                                </h5>
                                <ul className="mt-1 space-y-1">
                                  {category.attributes.map((attr) => (
                                    <li
                                      key={attr.id}
                                      className="text-sm text-gray-500 flex items-center gap-2"
                                    >
                                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                      {attr.name}
                                      {attr.required && (
                                        <span className="text-danger-400 text-xs">*</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setPendingDeleteKitId(null); }}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          if (pendingDeleteKitId) handleDelete(pendingDeleteKitId);
          setPendingDeleteKitId(null);
        }}
        title="Delete Interview Kit"
        message="Are you sure you want to delete this interview kit?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
