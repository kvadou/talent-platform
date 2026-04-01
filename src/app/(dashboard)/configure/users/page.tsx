'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

type User = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  marketAccess: { market: { id: string; name: string } }[];
};

type Market = {
  id: string;
  name: string;
};

const ROLE_LABELS: Record<string, string> = {
  HQ_ADMIN: 'HQ Admin',
  MARKET_ADMIN: 'Market Admin',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
};

const ROLE_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  HQ_ADMIN: 'success',
  MARKET_ADMIN: 'info',
  RECRUITER: 'warning',
  HIRING_MANAGER: 'neutral',
  INTERVIEWER: 'neutral',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [usersRes, marketsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/markets'),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      if (marketsRes.ok) {
        const data = await marketsRes.json();
        setMarkets(data.markets || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const searchLower = search.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      ROLE_LABELS[user.role]?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your team members, or invite new users
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardHeader
          title={`${users.length} Users`}
          action={
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          }
        />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-medium">
                    {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email}
                      </span>
                      <Badge variant={ROLE_VARIANTS[user.role] || 'neutral'}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                      {!user.isActive && (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <EnvelopeIcon className="w-3.5 h-3.5" />
                      {user.email}
                    </div>
                    {user.marketAccess?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {user.marketAccess.slice(0, 3).map((ma) => (
                          <span
                            key={ma.market.id}
                            className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600"
                          >
                            {ma.market.name}
                          </span>
                        ))}
                        {user.marketAccess.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{user.marketAccess.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No users found matching your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          markets={markets}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            fetchUsers();
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          markets={markets}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function InviteUserModal({
  markets,
  onClose,
  onSuccess,
}: {
  markets: Market[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('RECRUITER');
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMarket(marketId: string) {
    setSelectedMarkets((prev) =>
      prev.includes(marketId)
        ? prev.filter((id) => id !== marketId)
        : [...prev, marketId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          role,
          marketIds: selectedMarkets.length > 0 ? selectedMarkets : undefined,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to invite user');
      }
    } catch (err) {
      console.error('Failed to invite user:', err);
      setError('Failed to invite user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite User</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-danger-500">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
            >
              <option value="HQ_ADMIN">HQ Admin</option>
              <option value="MARKET_ADMIN">Market Admin</option>
              <option value="RECRUITER">Recruiter</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
              <option value="INTERVIEWER">Interviewer</option>
            </select>
          </div>

          {markets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Market Access
              </label>
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {markets.map((market) => (
                  <label
                    key={market.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMarkets.includes(market.id)}
                      onChange={() => toggleMarket(market.id)}
                      className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
                    />
                    <span className="text-sm text-gray-700">{market.name}</span>
                  </label>
                ))}
              </div>
              {selectedMarkets.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-danger-600 bg-danger-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !email.trim()}>
              {saving ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  markets,
  onClose,
  onSuccess,
}: {
  user: User;
  markets: Market[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [role, setRole] = useState(user.role);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    user.marketAccess?.map((ma) => ma.market.id) || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMarket(marketId: string) {
    setSelectedMarkets((prev) =>
      prev.includes(marketId)
        ? prev.filter((id) => id !== marketId)
        : [...prev, marketId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          role,
          marketIds: selectedMarkets,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update user');
      }
    } catch (err) {
      console.error('Failed to update user:', err);
      setError('Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={user.email}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
            >
              <option value="HQ_ADMIN">HQ Admin</option>
              <option value="MARKET_ADMIN">Market Admin</option>
              <option value="RECRUITER">Recruiter</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
              <option value="INTERVIEWER">Interviewer</option>
            </select>
          </div>

          {markets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Market Access
              </label>
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {markets.map((market) => (
                  <label
                    key={market.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMarkets.includes(market.id)}
                      onChange={() => toggleMarket(market.id)}
                      className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
                    />
                    <span className="text-sm text-gray-700">{market.name}</span>
                  </label>
                ))}
              </div>
              {selectedMarkets.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 py-2">
            {user.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="neutral">Pending Invitation</Badge>
            )}
          </div>

          {error && (
            <div className="text-sm text-danger-600 bg-danger-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
