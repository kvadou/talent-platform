'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow, format, isPast, isToday } from 'date-fns';

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
};

type Props = {
  applicationId: string;
  candidateId: string;
  onRefresh: () => void;
};

type FilterStatus = 'all' | 'attention' | 'pending' | 'completed';

export function TasksPanel({ applicationId, candidateId, onRefresh }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${applicationId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function createTask() {
    if (!newTask.title.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        setNewTask({ title: '', description: '', dueDate: '', priority: 'MEDIUM' });
        setShowCreateForm(false);
        fetchTasks();
        onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const res = await fetch(`/api/applications/${applicationId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const res = await fetch(`/api/applications/${applicationId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchTasks();
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }

  function needsAttention(task: Task) {
    if (task.status === 'COMPLETED') return false;
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return isPast(due) || isToday(due);
  }

  const filteredTasks = tasks.filter((task) => {
    switch (filter) {
      case 'attention':
        return needsAttention(task);
      case 'pending':
        return task.status !== 'COMPLETED';
      case 'completed':
        return task.status === 'COMPLETED';
      default:
        return true;
    }
  });

  const attentionCount = tasks.filter(needsAttention).length;
  const pendingCount = tasks.filter((t) => t.status !== 'COMPLETED').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  function getDueDateDisplay(dueDate: string | null) {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const isOverdue = isPast(date) && !isToday(date);
    const isDueToday = isToday(date);

    return (
      <span
        className={`text-xs flex items-center gap-1 ${
          isOverdue ? 'text-danger-600' : isDueToday ? 'text-warning-600' : 'text-gray-500'
        }`}
      >
        <CalendarIcon className="w-3 h-3" />
        {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : format(date, 'MMM d')}
      </span>
    );
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'HIGH':
        return 'bg-danger-100 text-danger-700';
      case 'MEDIUM':
        return 'bg-warning-100 text-warning-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Tasks & Reminders</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Tasks & Reminders</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-1.5 text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({tasks.length})
          </button>
          {attentionCount > 0 && (
            <button
              onClick={() => setFilter('attention')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                filter === 'attention' ? 'bg-danger-600 text-white' : 'text-danger-600 hover:bg-danger-50'
              }`}
            >
              <ExclamationTriangleIcon className="w-3 h-3" />
              Attention ({attentionCount})
            </button>
          )}
          <button
            onClick={() => setFilter('pending')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              filter === 'pending' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
              filter === 'completed' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Done ({completedCount})
          </button>
        </div>
      </div>

      {/* Create Task Form */}
      {showCreateForm && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="space-y-3">
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Task title..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              autoFocus
            />
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              rows={2}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              />
              <select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask({ ...newTask, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })
                }
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTask}
                disabled={!newTask.title.trim() || submitting}
                className="flex-1 px-3 py-2 text-sm text-white bg-brand-purple rounded-lg hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTasks.length === 0 ? (
          <div className="py-8 text-center">
            <ClockIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Click + to add a task or reminder
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 rounded-lg border transition-colors ${
                  task.status === 'COMPLETED'
                    ? 'bg-gray-50 border-gray-100'
                    : needsAttention(task)
                    ? 'bg-danger-50 border-danger-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTaskStatus(task.id, task.status)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      task.status === 'COMPLETED'
                        ? 'bg-success-500 border-success-500 text-white'
                        : 'border-gray-300 hover:border-brand-purple'
                    }`}
                  >
                    {task.status === 'COMPLETED' && <CheckIcon className="w-3 h-3" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        task.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {getDueDateDisplay(task.dueDate)}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-gray-400 hover:text-danger-500 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
