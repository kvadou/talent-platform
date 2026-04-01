'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  UserPlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MarketAccess = { market: { id: string; name: string } };

type User = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  marketAccess: MarketAccess[];
};

type Market = { id: string; name: string };

const ROLES = [
  'HQ_ADMIN',
  'MARKET_ADMIN',
  'RECRUITER',
  'HIRING_MANAGER',
  'INTERVIEWER',
] as const;

const ROLE_LABELS: Record<string, string> = {
  HQ_ADMIN: 'HQ Admin',
  MARKET_ADMIN: 'Market Admin',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
};

const ROLE_BADGE_VARIANT: Record<string, 'purple' | 'info' | 'cyan' | 'success' | 'neutral'> = {
  HQ_ADMIN: 'purple',
  MARKET_ADMIN: 'info',
  RECRUITER: 'cyan',
  HIRING_MANAGER: 'success',
  INTERVIEWER: 'neutral',
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite / Edit Modal
// ---------------------------------------------------------------------------

type UserFormData = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  marketIds: string[];
};

function UserFormModal({
  open,
  onClose,
  onSubmit,
  title,
  initialData,
  markets,
  mode,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
  title: string;
  initialData?: Partial<UserFormData>;
  markets: Market[];
  mode: 'invite' | 'edit';
  saving: boolean;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('RECRUITER');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);

  // Reset form when modal opens with initialData
  useEffect(() => {
    if (open) {
      setEmail(initialData?.email ?? '');
      setFirstName(initialData?.firstName ?? '');
      setLastName(initialData?.lastName ?? '');
      setRole(initialData?.role ?? 'RECRUITER');
      setSelectedMarkets(initialData?.marketIds ?? []);
    }
  }, [open, initialData]);

  const handleMarketToggle = (marketId: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(marketId) ? prev.filter((id) => id !== marketId) : [...prev, marketId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, firstName, lastName, role, marketIds: selectedMarkets });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={saving}
          >
            {mode === 'invite' ? 'Send Invite' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'invite' && (
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        )}

        {mode === 'edit' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="text-sm text-gray-500 bg-gray-50 px-3.5 py-2.5 rounded-lg border border-gray-200">
              {initialData?.email}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First"
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last"
          />
        </div>

        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Market Access</label>
          {markets.length === 0 ? (
            <p className="text-sm text-gray-500">No markets available.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
              {markets.map((market) => (
                <label
                  key={market.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedMarkets.includes(market.id)}
                    onChange={() => handleMarketToggle(market.id)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  {market.name}
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">
            HQ Admins have access to all markets regardless of selection.
          </p>
        </div>

        {mode === 'invite' && (
          <p className="text-xs text-gray-500 bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2">
            This person will be able to sign in via Google SSO using their email address.
          </p>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  // Fetch users and markets
  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/markets').then((r) => r.json()),
    ])
      .then(([usersData, marketsData]) => {
        setUsers(usersData.users || []);
        setMarkets(marketsData.markets || []);
      })
      .catch(() => {
        setError('Failed to load team members. Please refresh the page.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleInvite = async (data: UserFormData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ message: json.error || 'Failed to invite user', variant: 'error' });
        return;
      }
      // Add new user to list
      setUsers((prev) => [...prev, { ...json.user, createdAt: new Date().toISOString() }]);
      setInviteOpen(false);
      setToast({ message: `Invited ${data.email} successfully`, variant: 'success' });
    } catch {
      setToast({ message: 'Something went wrong. Please try again.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data: UserFormData) => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          marketIds: data.marketIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ message: json.error || 'Failed to update user', variant: 'error' });
        return;
      }
      // Update user in list
      setUsers((prev) =>
        prev.map((u) => (u.id === editUser.id ? { ...json.user, isActive: true } : u))
      );
      setEditUser(null);
      setToast({ message: 'User updated successfully', variant: 'success' });
    } catch {
      setToast({ message: 'Something went wrong. Please try again.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setToast({ message: json.error || 'Failed to remove user', variant: 'error' });
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setToast({ message: 'User removed successfully', variant: 'success' });
    } catch {
      setToast({ message: 'Something went wrong. Please try again.', variant: 'error' });
    }
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(iso)
    );

  const marketNames = (user: User) => {
    if (user.role === 'HQ_ADMIN') return 'All Markets';
    if (!user.marketAccess.length) return '--';
    return user.marketAccess.map((ma) => ma.market.name).join(', ');
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Team Members</h1>
        <Card>
          <CardContent>
            <p className="text-sm text-danger-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.variant === 'success'
              ? 'bg-success-600 text-white'
              : 'bg-danger-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-600">
            Manage who has access to Hiring Hub and what they can do.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          icon={<UserPlusIcon className="h-4 w-4" />}
          onClick={() => setInviteOpen(true)}
        >
          Invite User
        </Button>
      </div>

      {/* Users table */}
      <Card hover={false}>
        <CardHeader
          title={`${users.length} Team Member${users.length !== 1 ? 's' : ''}`}
          subtitle="All users who can access Hiring Hub"
        />
        <CardContent noPadding>
          {loading ? (
            <TableSkeleton />
          ) : (
            <div className="p-4 lg:p-0">
              <ResponsiveTable
                data={users}
                keyExtractor={(u) => u.id}
                emptyMessage="No team members yet. Invite someone to get started."
                columns={[
                  {
                    header: 'Name',
                    accessor: (user) => (
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {[user.firstName, user.lastName].filter(Boolean).join(' ') || '--'}
                        </div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    ),
                  },
                  {
                    header: 'Role',
                    accessor: (user) => (
                      <Badge variant={ROLE_BADGE_VARIANT[user.role] ?? 'neutral'} size="sm">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Markets',
                    accessor: (user) => (
                      <span className="text-sm text-gray-700">{marketNames(user)}</span>
                    ),
                  },
                  {
                    header: 'Joined',
                    mobileLabel: 'Joined',
                    accessor: (user) => (
                      <span className="text-sm text-gray-600">{formatDate(user.createdAt)}</span>
                    ),
                  },
                  {
                    header: '',
                    className: 'w-24 text-right',
                    accessor: (user) => (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditUser(user);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="Edit user"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUser(user);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                          title="Remove user"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <UserFormModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={handleInvite}
        title="Invite Team Member"
        markets={markets}
        mode="invite"
        saving={saving}
      />

      {/* Edit Modal */}
      {editUser && (
        <UserFormModal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          onSubmit={handleEdit}
          title="Edit Team Member"
          initialData={{
            email: editUser.email,
            firstName: editUser.firstName ?? '',
            lastName: editUser.lastName ?? '',
            role: editUser.role,
            marketIds: editUser.marketAccess.map((ma) => ma.market.id),
          }}
          markets={markets}
          mode="edit"
          saving={saving}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${
          deleteUser
            ? [deleteUser.firstName, deleteUser.lastName].filter(Boolean).join(' ') ||
              deleteUser.email
            : 'this user'
        }? They will lose access to Hiring Hub immediately. This cannot be undone.`}
        confirmLabel="Remove User"
        variant="danger"
      />
    </div>
  );
}
