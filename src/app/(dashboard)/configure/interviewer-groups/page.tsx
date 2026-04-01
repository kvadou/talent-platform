'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PlusIcon, UserGroupIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type InterviewerGroup = {
  id: string;
  name: string;
  description: string | null;
  members: Member[];
  memberCount: number;
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export default function InterviewerGroupsPage() {
  const [groups, setGroups] = useState<InterviewerGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<InterviewerGroup | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', memberIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<InterviewerGroup | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/interviewer-groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data.groups);
    } catch (err) {
      setError('Failed to load interviewer groups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, [fetchGroups, fetchUsers]);

  function openCreateModal() {
    setEditingGroup(null);
    setFormData({ name: '', description: '', memberIds: [] });
    setShowModal(true);
  }

  function openEditModal(group: InterviewerGroup) {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      memberIds: group.members.map((m) => m.id),
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const url = editingGroup
        ? `/api/interviewer-groups/${editingGroup.id}`
        : '/api/interviewer-groups';
      const method = editingGroup ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');

      setShowModal(false);
      fetchGroups();
    } catch (err) {
      setError('Failed to save interviewer group');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(group: InterviewerGroup) {
    setConfirmDeleteGroup(group);
  }

  async function confirmDeleteHandler() {
    if (!confirmDeleteGroup) return;
    const group = confirmDeleteGroup;
    setConfirmDeleteGroup(null);

    try {
      const response = await fetch(`/api/interviewer-groups/${group.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      fetchGroups();
    } catch (err) {
      setError('Failed to delete interviewer group');
      console.error(err);
    }
  }

  function toggleMember(userId: string) {
    setFormData((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter((id) => id !== userId)
        : [...prev.memberIds, userId],
    }));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Interviewer Groups</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage groups of interviewers</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading groups...
          </CardContent>
        </Card>
      </div>
    );
  }

  const modalFooter = (
    <>
      <Button variant="outline" onClick={() => setShowModal(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={!formData.name || saving}>
        {saving ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Interviewer Groups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage groups of interviewers
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-1">No interviewer groups yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create groups to organize interviewers for different types of interviews
            </p>
            <Button onClick={openCreateModal}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <UserGroupIcon className="w-6 h-6 text-brand-purple" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(group)}
                      className="p-1.5 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(group)}
                      className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-medium text-gray-900">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-3">{group.memberCount} members</p>
                {group.members.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {group.members.slice(0, 3).map((member) => (
                      <span
                        key={member.id}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                      >
                        {member.firstName} {member.lastName}
                      </span>
                    ))}
                    {group.members.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{group.members.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteGroup}
        onClose={() => setConfirmDeleteGroup(null)}
        onConfirm={confirmDeleteHandler}
        title="Delete Group"
        message={`Are you sure you want to delete "${confirmDeleteGroup?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingGroup ? 'Edit Interviewer Group' : 'Create Interviewer Group'}
        footer={modalFooter}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Technical Interviewers"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Brief description of this group"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Members
            </label>
            {users.length === 0 ? (
              <p className="text-sm text-gray-500">No users available</p>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={formData.memberIds.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                      className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {formData.memberIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.memberIds.map((id) => {
                  const user = users.find((u) => u.id === id);
                  if (!user) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 text-xs bg-purple-100 text-brand-purple px-2 py-1 rounded"
                    >
                      {user.firstName} {user.lastName}
                      <button
                        onClick={() => toggleMember(id)}
                        className="hover:text-purple-900"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
