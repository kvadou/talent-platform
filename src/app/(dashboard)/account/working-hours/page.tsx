'use client';

import { useState, useEffect } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface DaySchedule {
  dayOfWeek: string;
  isEnabled: boolean;
  slots: TimeSlot[];
}

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { key: 'SUNDAY', label: 'Sunday', short: 'Sun' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const time12 = `${hour12}:${minute} ${ampm}`;
  return { value: time24, label: time12 };
});

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS_OF_WEEK.map((day) => ({
  dayOfWeek: day.key,
  isEnabled: !['SATURDAY', 'SUNDAY'].includes(day.key),
  slots: [{ startTime: '09:00', endTime: '17:00' }],
}));

export default function WorkingHoursPage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch existing schedule
  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch('/api/account/availability');
        if (res.ok) {
          const data = await res.json();
          if (data.schedule && data.schedule.length > 0) {
            setSchedule(data.schedule);
          }
        }
      } catch (error) {
        console.error('Failed to fetch schedule:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  // Toggle day enabled
  const toggleDay = (dayIndex: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      updated[dayIndex] = {
        ...updated[dayIndex],
        isEnabled: !updated[dayIndex].isEnabled,
      };
      return updated;
    });
  };

  // Update time slot
  const updateSlot = (dayIndex: number, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule((prev) => {
      const updated = [...prev];
      updated[dayIndex] = {
        ...updated[dayIndex],
        slots: updated[dayIndex].slots.map((slot, i) =>
          i === slotIndex ? { ...slot, [field]: value } : slot
        ),
      };
      return updated;
    });
  };

  // Add time slot
  const addSlot = (dayIndex: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const lastSlot = updated[dayIndex].slots[updated[dayIndex].slots.length - 1];
      const newStart = lastSlot ? lastSlot.endTime : '09:00';
      updated[dayIndex] = {
        ...updated[dayIndex],
        slots: [...updated[dayIndex].slots, { startTime: newStart, endTime: '17:00' }],
      };
      return updated;
    });
  };

  // Remove time slot
  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      if (updated[dayIndex].slots.length > 1) {
        updated[dayIndex] = {
          ...updated[dayIndex],
          slots: updated[dayIndex].slots.filter((_, i) => i !== slotIndex),
        };
      }
      return updated;
    });
  };

  // Copy to all weekdays
  const copyToWeekdays = (sourceIndex: number) => {
    const sourceDay = schedule[sourceIndex];
    setSchedule((prev) =>
      prev.map((day, i) => {
        if (['SATURDAY', 'SUNDAY'].includes(day.dayOfWeek)) return day;
        return {
          ...day,
          isEnabled: sourceDay.isEnabled,
          slots: [...sourceDay.slots],
        };
      })
    );
  };

  // Save schedule
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/account/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });

      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Working hours saved successfully!' });
      } else {
        const error = await res.json();
        setSaveMessage({ type: 'error', text: error.error || 'Failed to save' });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Format time for display
  const formatTime = (time24: string): string => {
    const option = TIME_OPTIONS.find((t) => t.value === time24);
    return option?.label || time24;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-slate-200 rounded-full" />
              <div className="w-24 h-4 bg-slate-200 rounded" />
              <div className="flex-1 h-12 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {/* Header */}
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <ClockIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Working Hours</h2>
            <p className="text-sm text-slate-500 mt-1">
              Set your weekly availability for scheduling. These hours determine when others can book time with you.
            </p>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="p-6 sm:p-8">
        <div className="space-y-4">
          {schedule.map((day, dayIndex) => {
            const dayInfo = DAYS_OF_WEEK.find((d) => d.key === day.dayOfWeek)!;

            return (
              <div
                key={day.dayOfWeek}
                className={`
                  relative rounded-xl border-2 transition-all duration-200
                  ${day.isEnabled
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-100 bg-slate-50'
                  }
                `}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 sm:w-32">
                    <button
                      onClick={() => toggleDay(dayIndex)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${day.isEnabled ? 'bg-purple-600' : 'bg-slate-300'}
                      `}
                    >
                      <span
                        className={`
                          absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                          ${day.isEnabled ? 'left-7' : 'left-1'}
                        `}
                      />
                    </button>
                    <span
                      className={`font-medium ${
                        day.isEnabled ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {dayInfo.label}
                    </span>
                  </div>

                  {/* Time Slots */}
                  <div className="flex-1">
                    {day.isEnabled ? (
                      <div className="space-y-2">
                        {day.slots.map((slot, slotIndex) => (
                          <div key={slotIndex} className="flex items-center gap-2">
                            <select
                              value={slot.startTime}
                              onChange={(e) => updateSlot(dayIndex, slotIndex, 'startTime', e.target.value)}
                              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
                                       focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500
                                       bg-white"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            <span className="text-slate-400">to</span>
                            <select
                              value={slot.endTime}
                              onChange={(e) => updateSlot(dayIndex, slotIndex, 'endTime', e.target.value)}
                              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
                                       focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500
                                       bg-white"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            {day.slots.length > 1 && (
                              <button
                                onClick={() => removeSlot(dayIndex, slotIndex)}
                                className="p-2 text-slate-400 hover:text-danger-500 transition-colors"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addSlot(dayIndex)}
                          className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Add hours
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Unavailable</span>
                    )}
                  </div>

                  {/* Copy to Weekdays */}
                  {day.isEnabled && dayIndex < 5 && (
                    <button
                      onClick={() => copyToWeekdays(dayIndex)}
                      className="text-xs text-slate-400 hover:text-purple-600 transition-colors whitespace-nowrap"
                    >
                      Copy to weekdays
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="p-6 sm:p-8 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {saveMessage && (
            <div
              className={`flex items-center gap-2 text-sm ${
                saveMessage.type === 'success' ? 'text-success-600' : 'text-danger-600'
              }`}
            >
              {saveMessage.type === 'success' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <ExclamationCircleIcon className="w-5 h-5" />
              )}
              {saveMessage.text}
            </div>
          )}
          <div className="sm:ml-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700
                         text-white font-medium rounded-xl shadow-lg shadow-purple-200
                         hover:from-purple-700 hover:to-purple-800
                         focus:outline-none focus:ring-4 focus:ring-purple-200
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Working Hours'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
