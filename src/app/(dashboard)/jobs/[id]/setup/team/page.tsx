'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type TeamMember = {
  id: string;
  userId: string;
  role: 'HIRING_MANAGER' | 'RECRUITER' | 'COORDINATOR' | 'SOURCER' | 'INTERVIEWER';
  isResponsibleForTasks: boolean;
  permissions: string[];
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

const ROLES = [
  { value: 'HIRING_MANAGER', label: 'Hiring Manager', description: 'Full access to job and candidates' },
  { value: 'RECRUITER', label: 'Recruiter', description: 'Manage candidates and scheduling' },
  { value: 'COORDINATOR', label: 'Coordinator', description: 'Schedule interviews' },
  { value: 'SOURCER', label: 'Sourcer', description: 'Add and source candidates' },
  { value: 'INTERVIEWER', label: 'Interviewer', description: 'View and submit feedback' },
];

const ROLE_COLORS: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  HIRING_MANAGER: 'success',
  RECRUITER: 'warning',
  COORDINATOR: 'neutral',
  SOURCER: 'neutral',
  INTERVIEWER: 'neutral',
};

export default function HiringTeamPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('RECRUITER');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingRemoveMemberId, setPendingRemoveMemberId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [teamRes, usersRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/team`),
        fetch('/api/users'),
      ]);

      if (teamRes.ok) {
        const data = await teamRes.json();
        setTeamMembers(data.team || []);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setAvailableUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function addTeamMember() {
    if (!selectedUserId || !selectedRole) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setSelectedUserId('');
        setSelectedRole('RECRUITER');
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to add team member', err);
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(memberId: string, role: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/team/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to update role', err);
    } finally {
      setSaving(false);
    }
  }

  function initiateRemoveMember(memberId: string) {
    setPendingRemoveMemberId(memberId);
    setShowRemoveConfirm(true);
  }

  async function removeTeamMember(memberId: string) {
    setSaving(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}/team/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to remove team member', err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTaskResponsibility(memberId: string, current: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/team/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResponsibleForTasks: !current }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to update task responsibility', err);
    } finally {
      setSaving(false);
    }
  }

  // Filter out users already on the team
  const teamUserIds = new Set(teamMembers.map((m) => m.userId));
  const usersNotOnTeam = availableUsers.filter((u) => !teamUserIds.has(u.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Hiring Team</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage who can access this job and their roles.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {teamMembers.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-brand-purple">
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                  </div>

                  <select
                    value={member.role}
                    onChange={(e) => updateRole(member.id, e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                    disabled={saving}
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={member.isResponsibleForTasks}
                      onChange={() =>
                        toggleTaskResponsibility(member.id, member.isResponsibleForTasks)
                      }
                      className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                      disabled={saving}
                    />
                    <span className="text-gray-600">Responsible for tasks</span>
                  </label>

                  <button
                    onClick={() => initiateRemoveMember(member.id)}
                    disabled={saving}
                    className="p-2 text-gray-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <UserCircleIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No team members assigned yet.</p>
              <Button onClick={() => setShowAddModal(true)}>
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Add First Member
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role descriptions */}
      <Card>
        <CardHeader title="Role Permissions" />
        <CardContent>
          <div className="space-y-3">
            {ROLES.map((role) => (
              <div key={role.value} className="flex items-center gap-3">
                <Badge variant={ROLE_COLORS[role.value] || 'neutral'}>
                  {role.label}
                </Badge>
                <span className="text-sm text-gray-600">{role.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Confirmation */}
      <ConfirmModal
        open={showRemoveConfirm}
        onClose={() => { setShowRemoveConfirm(false); setPendingRemoveMemberId(null); }}
        onConfirm={() => {
          setShowRemoveConfirm(false);
          if (pendingRemoveMemberId) removeTeamMember(pendingRemoveMemberId);
          setPendingRemoveMemberId(null);
        }}
        title="Remove Team Member"
        message="Remove this team member from the job?"
        confirmLabel="Remove"
        variant="danger"
      />

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Team Member
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  <option value="">Select a user...</option>
                  {usersNotOnTeam.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={addTeamMember}
                disabled={!selectedUserId || saving}
              >
                Add Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
