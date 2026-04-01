'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { format, addDays, startOfWeek, addWeeks, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';

interface DateTimePickerProps {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

// Common interview time slots (15-minute increments during business hours)
const TIME_SLOTS = [
  '9:00 AM', '9:15 AM', '9:30 AM', '9:45 AM',
  '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM',
  '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
  '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM',
  '1:00 PM', '1:15 PM', '1:30 PM', '1:45 PM',
  '2:00 PM', '2:15 PM', '2:30 PM', '2:45 PM',
  '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM',
  '4:00 PM', '4:15 PM', '4:30 PM', '4:45 PM',
  '5:00 PM', '5:15 PM', '5:30 PM', '5:45 PM',
];

// Popular time slots shown as quick buttons
const QUICK_TIMES = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];

export function DateTimePicker({ name, label, required, defaultValue, onChange }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('10:00 AM');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timeSearch, setTimeSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // Parse default value
  useEffect(() => {
    if (defaultValue) {
      const date = new Date(defaultValue);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
        setSelectedTime(format(date, 'h:mm a'));
      }
    }
  }, [defaultValue]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert time string to 24h format for datetime-local input
  function timeToISOString(date: Date, timeStr: string): string {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return '';

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result.toISOString().slice(0, 16);
  }

  // Get the final datetime-local value
  const getValue = useCallback((): string => {
    if (!selectedDate) return '';
    return timeToISOString(selectedDate, selectedTime);
  }, [selectedDate, selectedTime]);

  // Notify parent of changes
  useEffect(() => {
    const value = getValue();
    if (value && onChange) {
      onChange(value);
    }
  }, [getValue, onChange]);

  // Quick date buttons
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const nextMonday = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = addDays(startOfWeek(monthEnd), 6);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter time slots based on search
  const filteredTimes = timeSearch
    ? TIME_SLOTS.filter(t => t.toLowerCase().includes(timeSearch.toLowerCase()))
    : TIME_SLOTS;

  // Parse typed time - accepts any valid minute (not rounded)
  // Examples: "205" → "2:05 PM", "2:05" → "2:05 PM", "2:05pm" → "2:05 PM", "14:05" → "2:05 PM"
  function parseTypedTime(input: string): string | null {
    const trimmed = input.trim();

    // Pattern 1: "2:05", "2:05pm", "2:05 pm", "14:05"
    const colonPattern = /^(\d{1,2}):(\d{2})\s*(a|p|am|pm)?$/i;
    // Pattern 2: "205", "205pm", "1405" (3-4 digits without colon)
    const noColonPattern = /^(\d{1,2})(\d{2})\s*(a|p|am|pm)?$/i;
    // Pattern 3: "2pm", "2p", "2 pm" (hour only with period)
    const hourOnlyPattern = /^(\d{1,2})\s*(a|p|am|pm)$/i;
    // Pattern 4: Just a number like "2" or "14"
    const justNumberPattern = /^(\d{1,2})$/;

    let hours: number;
    let minutes: number;
    let period: string;

    // Try colon pattern first (e.g., "2:05", "2:05pm")
    let match = trimmed.match(colonPattern);
    if (match) {
      hours = parseInt(match[1]);
      minutes = parseInt(match[2]);
      period = (match[3] || '').toLowerCase();
    } else {
      // Try no-colon pattern (e.g., "205", "1405")
      match = trimmed.match(noColonPattern);
      if (match) {
        hours = parseInt(match[1]);
        minutes = parseInt(match[2]);
        period = (match[3] || '').toLowerCase();
      } else {
        // Try hour-only with period (e.g., "2pm")
        match = trimmed.match(hourOnlyPattern);
        if (match) {
          hours = parseInt(match[1]);
          minutes = 0;
          period = match[2].toLowerCase();
        } else {
          // Try just a number (e.g., "2", "14")
          match = trimmed.match(justNumberPattern);
          if (match) {
            hours = parseInt(match[1]);
            minutes = 0;
            period = '';
          } else {
            return null;
          }
        }
      }
    }

    // Validate minutes
    if (minutes < 0 || minutes > 59) return null;

    // Handle 24-hour format (e.g., "14:05" → "2:05 PM")
    if (hours >= 13 && hours <= 23) {
      period = 'pm';
      hours -= 12;
    } else if (hours === 0) {
      hours = 12;
      period = period || 'am';
    } else if (hours === 12) {
      period = period || 'pm';
    } else if (hours > 23) {
      return null;
    }

    // Smart AM/PM guessing for business hours if not specified
    if (!period || (period !== 'a' && period !== 'am' && period !== 'p' && period !== 'pm')) {
      // Assume PM for 1-6, AM for 7-11, PM for 12
      if (hours >= 1 && hours <= 6) {
        period = 'pm';
      } else if (hours >= 7 && hours <= 11) {
        period = 'am';
      } else {
        period = 'pm';
      }
    }

    // Normalize period
    const finalPeriod = (period === 'a' || period === 'am') ? 'AM' : 'PM';

    return `${hours}:${minutes.toString().padStart(2, '0')} ${finalPeriod}`;
  }

  function handleTimeInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const parsed = parseTypedTime(timeSearch);
      if (parsed) {
        setSelectedTime(parsed);
        setTimeSearch('');
      }
    }
  }

  function handleTimeInputBlur() {
    if (timeSearch) {
      const parsed = parseTypedTime(timeSearch);
      if (parsed) {
        setSelectedTime(parsed);
      }
      setTimeSearch('');
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={getValue()} />

      {/* Display button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent"
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
          {selectedDate
            ? `${format(selectedDate, 'EEE, MMM d, yyyy')} at ${selectedTime}`
            : 'Select date and time...'}
        </span>
        <CalendarIcon className="w-5 h-5 text-gray-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-[420px]">
          {/* Quick date buttons */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectedDate && isSameDay(selectedDate, today)
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'border-gray-200 hover:border-brand-purple hover:text-brand-purple'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrow)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectedDate && isSameDay(selectedDate, tomorrow)
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'border-gray-200 hover:border-brand-purple hover:text-brand-purple'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(nextMonday)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectedDate && isSameDay(selectedDate, nextMonday)
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'border-gray-200 hover:border-brand-purple hover:text-brand-purple'
              }`}
            >
              Next Monday
            </button>
          </div>

          <div className="flex gap-4">
            {/* Calendar */}
            <div className="flex-1">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-medium text-gray-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, today);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isPast = day < today && !isToday;

                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isPast}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        w-8 h-8 text-sm rounded-lg transition-colors
                        ${isSelected ? 'bg-brand-purple text-white' : ''}
                        ${!isSelected && isToday ? 'border-2 border-brand-purple text-brand-purple' : ''}
                        ${!isSelected && !isToday && isCurrentMonth && !isPast ? 'hover:bg-gray-100 text-gray-900' : ''}
                        ${!isCurrentMonth || isPast ? 'text-gray-300' : ''}
                        ${isPast ? 'cursor-not-allowed' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time selector */}
            <div className="w-32 border-l pl-4">
              <div className="text-xs font-medium text-gray-500 mb-2">TIME</div>

              {/* Time input */}
              <input
                ref={timeInputRef}
                type="text"
                placeholder="Type time..."
                value={timeSearch}
                onChange={(e) => setTimeSearch(e.target.value)}
                onKeyDown={handleTimeInputKeyDown}
                onBlur={handleTimeInputBlur}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-brand-purple"
              />

              {/* Time slots */}
              <div className="h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredTimes.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setSelectedTime(time);
                      setTimeSearch('');
                    }}
                    className={`
                      w-full px-2 py-1.5 text-sm rounded-lg text-left transition-colors
                      ${selectedTime === time
                        ? 'bg-brand-purple text-white'
                        : QUICK_TIMES.includes(time)
                          ? 'bg-gray-50 hover:bg-brand-purple/10 text-gray-900 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
                      }
                    `}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setSelectedTime('10:00 AM');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={!selectedDate}
              className="px-4 py-1.5 text-sm font-medium bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
      `}</style>
    </div>
  );
}
