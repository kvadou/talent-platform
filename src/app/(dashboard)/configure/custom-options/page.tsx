'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  TagIcon,
  LinkIcon,
  XCircleIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

type Tab = 'tags' | 'sources' | 'rejection-reasons';

type CustomOption = {
  id: string;
  name: string;
  category?: string;
  isActive: boolean;
};

export default function CustomOptionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('tags');
  const [tags, setTags] = useState<CustomOption[]>([]);
  const [sources, setSources] = useState<CustomOption[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<CustomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [tagsRes, sourcesRes, rejectionRes] = await Promise.all([
        fetch('/api/custom-options/tags'),
        fetch('/api/custom-options/sources'),
        fetch('/api/custom-options/rejection-reasons'),
      ]);

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data.tags || []);
      }
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }
      if (rejectionRes.ok) {
        const data = await rejectionRes.json();
        setRejectionReasons(data.reasons || []);
      }
    } catch (err) {
      console.error('Failed to fetch custom options:', err);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'tags' as Tab, name: 'Candidate Tags', icon: TagIcon, count: tags.length },
    { id: 'sources' as Tab, name: 'Sources', icon: LinkIcon, count: sources.length },
    { id: 'rejection-reasons' as Tab, name: 'Rejection Reasons', icon: XCircleIcon, count: rejectionReasons.length },
  ];

  const currentItems = activeTab === 'tags' ? tags : activeTab === 'sources' ? sources : rejectionReasons;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Custom Options</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage custom tags, sources, rejection reasons, and referrers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-brand-purple shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
              <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={tabs.find((t) => t.id === activeTab)?.name || ''}
          action={
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <PlusIcon className="w-4 h-4 mr-1.5" />
              Add New
            </Button>
          }
        />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {currentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {item.name}
                  </span>
                  {item.category && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">
                      {item.category}
                    </span>
                  )}
                  {!item.isActive && (
                    <span className="text-xs px-2 py-0.5 bg-danger-50 rounded text-danger-600">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {currentItems.length === 0 && (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-2">
                  {activeTab === 'tags' && <TagIcon className="w-12 h-12 mx-auto" />}
                  {activeTab === 'sources' && <LinkIcon className="w-12 h-12 mx-auto" />}
                  {activeTab === 'rejection-reasons' && <XCircleIcon className="w-12 h-12 mx-auto" />}
                </div>
                <p className="text-gray-500">No {activeTab.replace('-', ' ')} configured yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddModal(true)}
                >
                  <PlusIcon className="w-4 h-4 mr-1.5" />
                  Add First
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Modal */}
      {showAddModal && (
        <AddOptionModal
          type={activeTab}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function AddOptionModal({
  type,
  onClose,
  onSuccess,
}: {
  type: Tab;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const title = type === 'tags' ? 'Add Tag' : type === 'sources' ? 'Add Source' : 'Add Rejection Reason';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const endpoint = type === 'tags'
        ? '/api/custom-options/tags'
        : type === 'sources'
        ? '/api/custom-options/sources'
        : '/api/custom-options/rejection-reasons';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
        }),
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to add option:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-danger-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={type === 'tags' ? 'e.g., Remote OK' : type === 'sources' ? 'e.g., LinkedIn' : 'e.g., Not a fit'}
            />
          </div>

          {type === 'rejection-reasons' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
              >
                <option value="">No category</option>
                <option value="Skills">Skills</option>
                <option value="Experience">Experience</option>
                <option value="Culture Fit">Culture Fit</option>
                <option value="Compensation">Compensation</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
