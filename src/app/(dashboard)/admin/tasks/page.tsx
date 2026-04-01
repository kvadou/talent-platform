'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { PlusIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  assignee: { firstName: string; lastName: string };
  application?: {
    id: string;
    candidate: { firstName: string; lastName: string };
    job: { title: string };
  };
  job?: { title: string };
  stage?: { name: string };
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function priorityVariant(priority: string): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
  switch (priority) {
    case 'URGENT':
      return 'warning';
    case 'HIGH':
      return 'info';
    case 'MEDIUM':
      return 'neutral';
    case 'LOW':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function statusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    case 'PENDING':
      return 'neutral';
    case 'CANCELLED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

// --- Inline status toggle dropdown ---

function StatusToggle({ task, onStatusChange }: { task: Task; onStatusChange: (taskId: string, status: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 group"
      >
        <Badge variant={statusVariant(task.status)}>{STATUS_LABELS[task.status] || task.status}</Badge>
        <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </button>
      {open && (
        <>
          {/* Invisible backdrop to close dropdown */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onStatusChange(task.id, s);
                  setOpen(false);
                }}
                className={twMerge(
                  'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors',
                  task.status === s ? 'font-semibold text-purple-700 bg-purple-50' : 'text-gray-700'
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Create Task Modal ---

function CreateTaskModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch users for assignee dropdown when modal opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, [open]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setPriority('MEDIUM');
      setDueAt('');
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, string> = { title: title.trim(), priority };
      if (description.trim()) body.description = description.trim();
      if (assigneeId) body.assigneeId = assigneeId;
      if (dueAt) body.dueAt = dueAt;

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create task.');
        setSubmitting(false);
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Task"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create Task
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          placeholder="e.g. Follow up with candidate"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none placeholder:text-gray-500 resize-none"
            rows={3}
            placeholder="Optional details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <Select
          label="Assignee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">Assign to me (default)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </Select>

        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>

        <Input
          label="Due Date"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />

        {error && (
          <p className="text-sm text-danger-600">{error}</p>
        )}
      </form>
    </Modal>
  );
}

// --- Tasks Page ---

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);

    fetch(`/api/tasks?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleStatusChange(taskId: string, newStatus: string) {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      if (res.ok) {
        // Optimistic: update local state instead of full refetch
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch {
      // Silently fail — the badge just won't change
    } finally {
      setUpdatingTaskId(null);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  const overdue = tasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) < new Date() && t.status !== 'COMPLETED'
  );
  const dueToday = tasks.filter(
    (t) =>
      t.dueAt &&
      new Date(t.dueAt).toDateString() === new Date().toDateString() &&
      t.status !== 'COMPLETED'
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-600">Manage tasks across applications and jobs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {overdue.length > 0 && (
            <Badge variant="warning">{overdue.length} Overdue</Badge>
          )}
          {dueToday.length > 0 && (
            <Badge variant="info">{dueToday.length} Due Today</Badge>
          )}
          <Button
            className="w-full sm:w-auto"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Task
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Filters"
          action={
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          }
        />
        <CardContent className="p-0">
          <div className="p-4 lg:p-0">
            <ResponsiveTable
              data={tasks}
              columns={[
                {
                  header: 'Task',
                  accessor: (task) => (
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Context',
                  accessor: (task) => (
                    <div className="text-sm text-gray-600">
                      {task.application ? (
                        <div>
                          <div>{task.application.candidate.firstName} {task.application.candidate.lastName}</div>
                          <div className="text-xs text-gray-500">{task.application.job.title}</div>
                        </div>
                      ) : task.job ? (
                        task.job.title
                      ) : task.stage ? (
                        task.stage.name
                      ) : (
                        '—'
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Assignee',
                  accessor: (task) => (
                    <span className="text-sm text-gray-700">
                      {task.assignee.firstName} {task.assignee.lastName}
                    </span>
                  ),
                },
                {
                  header: 'Priority',
                  accessor: (task) => <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>,
                },
                {
                  header: 'Due Date',
                  mobileLabel: 'Due',
                  accessor: (task) => {
                    const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'COMPLETED';
                    return task.dueAt ? (
                      <span className={twMerge('text-sm', isOverdue ? 'text-yellow-600 font-semibold' : 'text-gray-600')}>
                        {new Intl.DateTimeFormat('en', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }).format(new Date(task.dueAt))}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-600">—</span>
                    );
                  },
                },
                {
                  header: 'Status',
                  accessor: (task) => (
                    <StatusToggle
                      task={task}
                      onStatusChange={handleStatusChange}
                    />
                  ),
                },
              ]}
              keyExtractor={(task) => task.id}
              emptyMessage="No tasks found."
            />
          </div>
        </CardContent>
      </Card>

      <CreateTaskModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchTasks}
      />
    </div>
  );
}

