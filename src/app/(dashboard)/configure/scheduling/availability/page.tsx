'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import { PlusIcon, TrashIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

type DayAvailability = {
  dayOfWeek: DayOfWeek;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
};

type ScheduleException = {
  id?: string;
  date: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
};

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { key: 'SUNDAY', label: 'Sunday', short: 'Sun' },
];

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00',
];

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

const defaultAvailability: DayAvailability[] = DAYS.map((day) => ({
  dayOfWeek: day.key,
  isEnabled: day.key !== 'SATURDAY' && day.key !== 'SUNDAY',
  startTime: '09:00',
  endTime: '17:00',
}));

export default function AvailabilityPage() {
  const [availability, setAvailability] = useState<DayAvailability[]>(defaultAvailability);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [newException, setNewException] = useState<ScheduleException>({
    date: '',
    isAvailable: false,
    reason: '',
  });

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const res = await fetch('/api/scheduling/availability');
      if (res.ok) {
        const data = await res.json();
        if (data.availability && data.availability.length > 0) {
          setAvailability(data.availability);
        }
        if (data.exceptions) {
          setExceptions(data.exceptions);
        }
      }
    } catch (error) {
      console.error('Failed to load availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (dayOfWeek: DayOfWeek) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, isEnabled: !day.isEnabled } : day
      )
    );
  };

  const handleTimeChange = (dayOfWeek: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/scheduling/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (error) {
      console.error('Failed to save availability:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddException = async () => {
    if (!newException.date) return;

    try {
      const res = await fetch('/api/scheduling/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newException),
      });
      if (res.ok) {
        const data = await res.json();
        setExceptions((prev) => [...prev, data]);
        setNewException({ date: '', isAvailable: false, reason: '' });
        setShowExceptionForm(false);
      }
    } catch (error) {
      console.error('Failed to add exception:', error);
    }
  };

  const handleDeleteException = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduling/exceptions/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setExceptions((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete exception:', error);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="mt-1 text-gray-600">
            Set your regular working hours for when candidates can book meetings with you.
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </div>

      {/* Weekly Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure your available hours for each day of the week.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {DAYS.map((day) => {
            const dayData = availability.find((a) => a.dayOfWeek === day.key);
            if (!dayData) return null;

            return (
              <div
                key={day.key}
                className={`px-6 py-4 flex items-center justify-between transition-colors ${
                  dayData.isEnabled ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4 min-w-[150px]">
                  <Switch
                    checked={dayData.isEnabled}
                    onChange={() => handleDayToggle(day.key)}
                    className={`${
                      dayData.isEnabled ? 'bg-brand-purple' : 'bg-gray-300'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        dayData.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                  <span
                    className={`font-medium ${dayData.isEnabled ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    {day.label}
                  </span>
                </div>

                {dayData.isEnabled ? (
                  <div className="flex items-center gap-3">
                    <select
                      value={dayData.startTime}
                      onChange={(e) => handleTimeChange(day.key, 'startTime', e.target.value)}
                      className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-sm"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-500">to</span>
                    <select
                      value={dayData.endTime}
                      onChange={(e) => handleTimeChange(day.key, 'endTime', e.target.value)}
                      className="block w-32 rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-sm"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Exceptions */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Date-Specific Hours</h2>
            <p className="text-sm text-gray-600 mt-1">
              Add exceptions for holidays, vacations, or days with special hours.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExceptionForm(true)}
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Exception
          </Button>
        </div>

        {/* Exception Form */}
        {showExceptionForm && (
          <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newException.date}
                  onChange={(e) => setNewException({ ...newException, date: e.target.value })}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                <select
                  value={newException.isAvailable ? 'available' : 'unavailable'}
                  onChange={(e) =>
                    setNewException({ ...newException, isAvailable: e.target.value === 'available' })
                  }
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-sm"
                >
                  <option value="unavailable">Unavailable (Day Off)</option>
                  <option value="available">Available (Custom Hours)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Holiday, Vacation"
                  value={newException.reason || ''}
                  onChange={(e) => setNewException({ ...newException, reason: e.target.value })}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddException}>
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowExceptionForm(false);
                    setNewException({ date: '', isAvailable: false, reason: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Exception List */}
        <div className="divide-y divide-gray-200">
          {exceptions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No date-specific exceptions set.</p>
              <p className="text-sm mt-1">
                Add exceptions for holidays, vacations, or days with special hours.
              </p>
            </div>
          ) : (
            exceptions.map((exception) => (
              <div
                key={exception.id}
                className="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">
                      {new Date(exception.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {exception.reason && (
                      <span className="ml-2 text-gray-500">({exception.reason})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      exception.isAvailable
                        ? 'bg-success-100 text-success-700'
                        : 'bg-danger-100 text-danger-700'
                    }`}
                  >
                    {exception.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                  <button
                    onClick={() => exception.id && handleDeleteException(exception.id)}
                    className="text-gray-400 hover:text-danger-500 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
