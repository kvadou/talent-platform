'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  PhoneIcon,
  VideoCameraIcon,
  MapPinIcon,
  LinkIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

type MeetingLocationType = 'PHONE' | 'GOOGLE_MEET' | 'ZOOM' | 'IN_PERSON' | 'CUSTOM';

type MeetingType = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration: number;
  color: string;
  isActive: boolean;
  locationType: MeetingLocationType;
  locationDetails?: string;
  googleMeetEnabled: boolean;
  zoomEnabled: boolean;
  zoomLink?: string;
  bufferBefore: number;
  bufferAfter: number;
  minNoticeHours: number;
  maxDaysOut: number;
  slotIncrement: number;
  maxPerDay?: number;
  maxPerWeek?: number;
  maxPerMonth?: number;
};

const LOCATION_TYPES: { value: MeetingLocationType; label: string; icon: React.ElementType }[] = [
  { value: 'PHONE', label: 'Phone Call', icon: PhoneIcon },
  { value: 'GOOGLE_MEET', label: 'Google Meet', icon: VideoCameraIcon },
  { value: 'ZOOM', label: 'Zoom', icon: VideoCameraIcon },
  { value: 'IN_PERSON', label: 'In Person', icon: MapPinIcon },
  { value: 'CUSTOM', label: 'Custom', icon: LinkIcon },
];

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60];
const SLOT_INCREMENT_OPTIONS = [15, 30, 60];
const NOTICE_OPTIONS = [0, 1, 2, 4, 12, 24, 48];
const MAX_DAYS_OPTIONS = [7, 14, 30, 60, 90];

const COLOR_OPTIONS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

const defaultMeetingType: Omit<MeetingType, 'id'> = {
  name: '',
  slug: '',
  description: '',
  duration: 30,
  color: '#3b82f6',
  isActive: true,
  locationType: 'PHONE',
  locationDetails: '',
  googleMeetEnabled: false,
  zoomEnabled: false,
  zoomLink: '',
  bufferBefore: 5,
  bufferAfter: 5,
  minNoticeHours: 24,
  maxDaysOut: 30,
  slotIncrement: 30,
};

export default function MeetingTypesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<MeetingType | null>(null);
  const [formData, setFormData] = useState<Omit<MeetingType, 'id'>>(defaultMeetingType);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openEditModal = useCallback((meetingType: MeetingType) => {
    setEditingType(meetingType);
    setFormData({
      name: meetingType.name,
      slug: meetingType.slug,
      description: meetingType.description || '',
      duration: meetingType.duration,
      color: meetingType.color,
      isActive: meetingType.isActive,
      locationType: meetingType.locationType,
      locationDetails: meetingType.locationDetails || '',
      googleMeetEnabled: meetingType.googleMeetEnabled,
      zoomEnabled: meetingType.zoomEnabled,
      zoomLink: meetingType.zoomLink || '',
      bufferBefore: meetingType.bufferBefore,
      bufferAfter: meetingType.bufferAfter,
      minNoticeHours: meetingType.minNoticeHours,
      maxDaysOut: meetingType.maxDaysOut,
      slotIncrement: meetingType.slotIncrement,
      maxPerDay: meetingType.maxPerDay,
      maxPerWeek: meetingType.maxPerWeek,
      maxPerMonth: meetingType.maxPerMonth,
    });
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  // Auto-open edit modal when ?edit=<id> is in the URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && meetingTypes.length > 0) {
      const toEdit = meetingTypes.find((m) => m.id === editId);
      if (toEdit) {
        openEditModal(toEdit);
      }
    }
  }, [searchParams, meetingTypes, openEditModal]);

  const loadMeetingTypes = async () => {
    try {
      const res = await fetch('/api/scheduling/meeting-types');
      if (res.ok) {
        const data = await res.json();
        setMeetingTypes(data);
      }
    } catch (error) {
      console.error('Failed to load meeting types:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: formData.slug || generateSlug(name),
    });
  };

  const openCreateModal = () => {
    setEditingType(null);
    setFormData(defaultMeetingType);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) return;

    setSaving(true);
    setSaveError(null);
    try {
      const url = editingType
        ? `/api/scheduling/meeting-types/${editingType.id}`
        : '/api/scheduling/meeting-types';
      const method = editingType ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await loadMeetingTypes();
        setIsModalOpen(false);
        // Clear ?edit= param so the useEffect doesn't re-open the modal
        if (searchParams.get('edit')) {
          router.replace('/configure/scheduling/meeting-types', { scroll: false });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || 'Failed to save meeting type');
      }
    } catch (error) {
      console.error('Failed to save meeting type:', error);
      setSaveError('Failed to save meeting type');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/scheduling/meeting-types/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMeetingTypes((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete meeting type:', error);
    }
  };

  const handleToggleActive = async (meetingType: MeetingType) => {
    try {
      const res = await fetch(`/api/scheduling/meeting-types/${meetingType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meetingType, isActive: !meetingType.isActive }),
      });
      if (res.ok) {
        setMeetingTypes((prev) =>
          prev.map((m) =>
            m.id === meetingType.id ? { ...m, isActive: !m.isActive } : m
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle meeting type:', error);
    }
  };

  const getLocationIcon = (type: MeetingLocationType) => {
    const locationType = LOCATION_TYPES.find((l) => l.value === type);
    return locationType?.icon || PhoneIcon;
  };

  const getLocationLabel = (type: MeetingLocationType) => {
    const locationType = LOCATION_TYPES.find((l) => l.value === type);
    return locationType?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Types</h1>
          <p className="mt-1 text-gray-600">
            Create and manage different types of meetings for interviews and calls.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusIcon className="w-4 h-4 mr-1" />
          New Meeting Type
        </Button>
      </div>

      {/* Meeting Types Grid */}
      {meetingTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClockIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No meeting types yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first meeting type to start scheduling interviews with candidates.
          </p>
          <Button onClick={openCreateModal}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Create Meeting Type
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meetingTypes.map((meetingType) => {
            const LocationIcon = getLocationIcon(meetingType.locationType);
            return (
              <div
                key={meetingType.id}
                className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-md ${
                  !meetingType.isActive ? 'opacity-60' : ''
                }`}
              >
                <div
                  className="h-2"
                  style={{ backgroundColor: meetingType.color }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${meetingType.color}20` }}
                      >
                        <LocationIcon
                          className="w-5 h-5"
                          style={{ color: meetingType.color }}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{meetingType.name}</h3>
                        <p className="text-sm text-gray-500">
                          {meetingType.duration} min · {getLocationLabel(meetingType.locationType)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(meetingType)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title={meetingType.isActive ? 'Disable' : 'Enable'}
                      >
                        {meetingType.isActive ? (
                          <EyeIcon className="w-4 h-4" />
                        ) : (
                          <EyeSlashIcon className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(meetingType)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(meetingType.id)}
                        className="p-1.5 text-gray-400 hover:text-danger-500 rounded-lg hover:bg-gray-100"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {meetingType.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {meetingType.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {meetingType.bufferBefore}m buffer before
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {meetingType.bufferAfter}m buffer after
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {meetingType.minNoticeHours}h notice
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Meeting Type"
        message="Are you sure you want to delete this meeting type?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Create/Edit Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white p-6 shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-6">
                    {editingType ? 'Edit Meeting Type' : 'Create Meeting Type'}
                  </Dialog.Title>

                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g., 30 Minute Phone Screen"
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          URL Slug
                        </label>
                        <input
                          type="text"
                          value={formData.slug}
                          onChange={(e) =>
                            setFormData({ ...formData, slug: e.target.value })
                          }
                          placeholder="phone-screen"
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration
                        </label>
                        <select
                          value={formData.duration}
                          onChange={(e) =>
                            setFormData({ ...formData, duration: parseInt(e.target.value) })
                          }
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        >
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d} minutes
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={2}
                        placeholder="Brief description shown to candidates..."
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                      </label>
                      <div className="flex gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setFormData({ ...formData, color })}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              formData.color === color
                                ? 'border-gray-900 scale-110'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {LOCATION_TYPES.map((loc) => {
                          const Icon = loc.icon;
                          return (
                            <button
                              key={loc.value}
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, locationType: loc.value })
                              }
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                                formData.locationType === loc.value
                                  ? 'border-brand-purple bg-purple-50 text-brand-purple'
                                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{loc.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Buffer Times */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Buffer Before
                        </label>
                        <select
                          value={formData.bufferBefore}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bufferBefore: parseInt(e.target.value),
                            })
                          }
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        >
                          {BUFFER_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b === 0 ? 'No buffer' : `${b} minutes`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Buffer After
                        </label>
                        <select
                          value={formData.bufferAfter}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bufferAfter: parseInt(e.target.value),
                            })
                          }
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        >
                          {BUFFER_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b === 0 ? 'No buffer' : `${b} minutes`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Scheduling Options */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Minimum Notice
                        </label>
                        <select
                          value={formData.minNoticeHours}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              minNoticeHours: parseInt(e.target.value),
                            })
                          }
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        >
                          {NOTICE_OPTIONS.map((h) => (
                            <option key={h} value={h}>
                              {h === 0 ? 'No minimum' : `${h} hours`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Days in Advance
                        </label>
                        <select
                          value={formData.maxDaysOut}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxDaysOut: parseInt(e.target.value),
                            })
                          }
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        >
                          {MAX_DAYS_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d} days
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Time Increments
                        </label>
                        <select
                          value={formData.slotIncrement}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              slotIncrement: parseInt(e.target.value),
                            })
                          }
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                        >
                          {SLOT_INCREMENT_OPTIONS.map((i) => (
                            <option key={i} value={i}>
                              {i} minutes
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {saveError && (
                    <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
                      {saveError}
                    </div>
                  )}

                  <div className="mt-8 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} loading={saving}>
                      {editingType ? 'Save Changes' : 'Create Meeting Type'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
