'use client';

import { useState } from 'react';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { AlertModal } from '@/components/ui/AlertModal';

type PrepItem = {
  id?: string;
  title: string;
  description: string | null;
  duration: number | null;
  order: number;
};

type Attribute = {
  id?: string;
  name: string;
  description: string | null;
  required: boolean;
  order: number;
};

type Category = {
  id?: string;
  name: string;
  order: number;
  attributes: Attribute[];
};

type InterviewKit = {
  id: string;
  name: string;
  type: string;
  duration: number;
  includesAudition: boolean;
  order: number;
  stage: { id: string; name: string; order: number } | null;
  prepItems: PrepItem[];
  categories: Category[];
};

type Stage = {
  id: string;
  name: string;
  order: number;
};

type Props = {
  jobId: string;
  kit: InterviewKit | null;
  stages: Stage[];
  onSave: () => void;
  onCancel: () => void;
};

const interviewTypes = [
  { value: 'PHONE_SCREEN', label: 'Phone Screen' },
  { value: 'VIDEO_INTERVIEW', label: 'Video Interview' },
  { value: 'VIDEO_INTERVIEW_AUDITION', label: 'Video Interview + Audition' },
  { value: 'IN_PERSON', label: 'In-Person Interview' },
  { value: 'TECHNICAL_INTERVIEW', label: 'Technical Interview' },
  { value: 'BEHAVIORAL_INTERVIEW', label: 'Behavioral Interview' },
  { value: 'FINAL_INTERVIEW', label: 'Final Interview' },
];

export function InterviewKitEditor({ jobId, kit, stages, onSave, onCancel }: Props) {
  const [name, setName] = useState(kit?.name || '');
  const [type, setType] = useState(kit?.type || 'PHONE_SCREEN');
  const [duration, setDuration] = useState(kit?.duration || 30);
  const [stageId, setStageId] = useState(kit?.stage?.id || '');
  const [includesAudition, setIncludesAudition] = useState(kit?.includesAudition || false);
  const [prepItems, setPrepItems] = useState<PrepItem[]>(
    kit?.prepItems || []
  );
  const [categories, setCategories] = useState<Category[]>(
    kit?.categories || []
  );
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const handleAddPrepItem = () => {
    setPrepItems([
      ...prepItems,
      {
        title: '',
        description: null,
        duration: null,
        order: prepItems.length,
      },
    ]);
  };

  const handleUpdatePrepItem = (index: number, field: keyof PrepItem, value: string | number | null) => {
    const updated = [...prepItems];
    updated[index] = { ...updated[index], [field]: value };
    setPrepItems(updated);
  };

  const handleRemovePrepItem = (index: number) => {
    setPrepItems(prepItems.filter((_, i) => i !== index));
  };

  const handleAddCategory = () => {
    setCategories([
      ...categories,
      {
        name: '',
        order: categories.length,
        attributes: [],
      },
    ]);
  };

  const handleUpdateCategory = (index: number, name: string) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], name };
    setCategories(updated);
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleAddAttribute = (categoryIndex: number) => {
    const updated = [...categories];
    updated[categoryIndex].attributes.push({
      name: '',
      description: null,
      required: true,
      order: updated[categoryIndex].attributes.length,
    });
    setCategories(updated);
  };

  const handleUpdateAttribute = (
    categoryIndex: number,
    attrIndex: number,
    field: keyof Attribute,
    value: string | boolean | null
  ) => {
    const updated = [...categories];
    updated[categoryIndex].attributes[attrIndex] = {
      ...updated[categoryIndex].attributes[attrIndex],
      [field]: value,
    };
    setCategories(updated);
  };

  const handleRemoveAttribute = (categoryIndex: number, attrIndex: number) => {
    const updated = [...categories];
    updated[categoryIndex].attributes = updated[categoryIndex].attributes.filter(
      (_, i) => i !== attrIndex
    );
    setCategories(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setAlertMsg('Please enter a kit name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        type,
        duration,
        stageId: stageId || null,
        includesAudition,
        prepItems: prepItems.filter((p) => p.title.trim()),
        categories: categories
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name,
            attributes: c.attributes.filter((a) => a.name.trim()),
          })),
      };

      const url = kit
        ? `/api/jobs/${jobId}/interview-kits/${kit.id}`
        : `/api/jobs/${jobId}/interview-kits`;

      const res = await fetch(url, {
        method: kit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      onSave();
    } catch (error) {
      console.error('Failed to save kit:', error);
      setAlertMsg('Failed to save interview kit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {kit ? 'Edit Interview Kit' : 'New Interview Kit'}
          </h1>
          <p className="text-gray-500 mt-1">
            Configure interview prep and scorecard attributes
          </p>
        </div>
      </div>

      {/* Basic Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Settings</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kit Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Phone Screen, Video Interview + Audition"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interview Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            >
              {interviewTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              min={5}
              max={240}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline Stage (Optional)
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            >
              <option value="">Any stage</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={includesAudition}
                onChange={(e) => setIncludesAudition(e.target.checked)}
                className="w-5 h-5 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
              />
              <span className="text-sm text-gray-700">
                Includes Storytelling Audition (final 10-15 minutes)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Interview Prep */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Interview Prep</h2>
            <p className="text-sm text-gray-500 mt-1">
              Talking points and topics for the interviewer
            </p>
          </div>
          <button
            onClick={handleAddPrepItem}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {prepItems.length === 0 ? (
          <p className="text-gray-400 text-sm italic py-4">
            No prep items yet. Add talking points for the interviewer.
          </p>
        ) : (
          <div className="space-y-3">
            {prepItems.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <Bars3Icon className="w-5 h-5 text-gray-300 mt-2 cursor-grab" />
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleUpdatePrepItem(index, 'title', e.target.value)}
                    placeholder="Topic title"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) =>
                        handleUpdatePrepItem(index, 'description', e.target.value || null)
                      }
                      placeholder="Description or talking points (optional)"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    />
                    <input
                      type="number"
                      value={item.duration || ''}
                      onChange={(e) =>
                        handleUpdatePrepItem(
                          index,
                          'duration',
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      placeholder="Min"
                      className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePrepItem(index)}
                  className="p-1.5 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scorecard Categories */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scorecard</h2>
            <p className="text-sm text-gray-500 mt-1">
              Evaluation criteria organized by category
            </p>
          </div>
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-gray-400 text-sm italic py-4">
            No categories yet. Add scorecard categories like Skills, Personality, etc.
          </p>
        ) : (
          <div className="space-y-6">
            {categories.map((category, catIndex) => (
              <div key={catIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200">
                  <Bars3Icon className="w-5 h-5 text-gray-300 cursor-grab" />
                  <input
                    type="text"
                    value={category.name}
                    onChange={(e) => handleUpdateCategory(catIndex, e.target.value)}
                    placeholder="Category name (e.g., Skills, Personality)"
                    className="flex-1 px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                  />
                  <button
                    onClick={() => handleAddAttribute(catIndex)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-brand-purple hover:bg-brand-purple/10 rounded transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Attribute
                  </button>
                  <button
                    onClick={() => handleRemoveCategory(catIndex)}
                    className="p-1.5 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Attributes */}
                <div className="p-3 space-y-2">
                  {category.attributes.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">
                      No attributes. Add evaluation criteria for this category.
                    </p>
                  ) : (
                    category.attributes.map((attr, attrIndex) => (
                      <div
                        key={attrIndex}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                      >
                        <Bars3Icon className="w-4 h-4 text-gray-300 cursor-grab" />
                        <input
                          type="text"
                          value={attr.name}
                          onChange={(e) =>
                            handleUpdateAttribute(catIndex, attrIndex, 'name', e.target.value)
                          }
                          placeholder="Attribute name"
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-gray-500">
                          <input
                            type="checkbox"
                            checked={attr.required}
                            onChange={(e) =>
                              handleUpdateAttribute(catIndex, attrIndex, 'required', e.target.checked)
                            }
                            className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
                          />
                          Required
                        </label>
                        <button
                          onClick={() => handleRemoveAttribute(catIndex, attrIndex)}
                          className="p-1 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : kit ? 'Save Changes' : 'Create Interview Kit'}
        </button>
      </div>

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />
    </div>
  );
}
