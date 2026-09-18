'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { X, Clock, MapPin, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchedulingPreferences } from '@/lib/hooks/use-schedule';

// ─── ScheduleModal ────────────────────────────────────────────────────────────
// Date/time picker modal with timezone selector and conflict feedback.

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { scheduledAt: string; timezone: string; reason?: string }) => Promise<void>;
  initialDate?: string;
  initialTimezone?: string;
  title?: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

// Subset of commonly-used IANA zones (keep list short to avoid overwhelming users)
const COMMON_TIMEZONES = [
  { label: 'UTC',                     value: 'UTC' },
  { label: 'America/New_York (EST)',   value: 'America/New_York' },
  { label: 'America/Chicago (CST)',    value: 'America/Chicago' },
  { label: 'America/Denver (MST)',     value: 'America/Denver' },
  { label: 'America/Los_Angeles (PST)',value: 'America/Los_Angeles' },
  { label: 'America/Sao_Paulo (BRT)', value: 'America/Sao_Paulo' },
  { label: 'Europe/London (GMT)',      value: 'Europe/London' },
  { label: 'Europe/Paris (CET)',       value: 'Europe/Paris' },
  { label: 'Europe/Istanbul (TRT)',    value: 'Europe/Istanbul' },
  { label: 'Asia/Dubai (GST)',         value: 'Asia/Dubai' },
  { label: 'Asia/Kolkata (IST)',       value: 'Asia/Kolkata' },
  { label: 'Asia/Singapore (SGT)',     value: 'Asia/Singapore' },
  { label: 'Asia/Tokyo (JST)',         value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (CST)',      value: 'Asia/Shanghai' },
  { label: 'Australia/Sydney (AEDT)', value: 'Australia/Sydney' },
];

export function ScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
  initialTimezone,
  title = 'Choose a Date & Time',
  confirmLabel = 'Confirm Schedule',
  isLoading,
}: ScheduleModalProps) {
  const { prefs } = useSchedulingPreferences();

  const defaultTz = initialTimezone ?? prefs?.timezone ?? 'UTC';
  const defaultDt = initialDate
    ? DateTime.fromISO(initialDate).setZone(defaultTz)
    : DateTime.now().setZone(defaultTz).plus({ hours: 2 }).startOf('hour');

  const [timezone, setTimezone] = useState(defaultTz);
  const [viewDate, setViewDate] = useState<DateTime>(defaultDt);
  const [selectedDate, setSelectedDate] = useState<DateTime | null>(defaultDt);
  const [hour, setHour]   = useState(defaultDt.hour);
  const [minute, setMinute] = useState(defaultDt.minute);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync timezone updates from preferences
  useEffect(() => {
    if (!initialTimezone && prefs?.timezone) {
      setTimezone(prefs.timezone);
    }
  }, [prefs?.timezone, initialTimezone]);

  // Build calendar grid
  const buildCalendar = useCallback(() => {
    const start    = viewDate.startOf('month').startOf('week');
    const end      = viewDate.endOf('month').endOf('week');
    const weeks: DateTime[][] = [];
    let current = start;
    let week: DateTime[] = [];

    while (current <= end) {
      week.push(current);
      if (week.length === 7) { weeks.push(week); week = []; }
      current = current.plus({ days: 1 });
    }
    return weeks;
  }, [viewDate]);

  const handleDateSelect = (day: DateTime) => {
    if (day < DateTime.now().startOf('day')) return; // Past days not selectable
    setSelectedDate(day);
  };

  const getScheduledAt = (): DateTime | null => {
    if (!selectedDate) return null;
    const m = minute > 59 ? 0 : minute;
    return selectedDate.set({ hour, minute: m, second: 0, millisecond: 0 });
  };

  const handleConfirm = async () => {
    setError(null);
    const dt = getScheduledAt();
    if (!dt) { setError('Please select a date'); return; }
    if (dt.toJSDate() <= new Date(Date.now() + 60_000)) {
      setError('Please select a future time (at least 1 minute from now)');
      return;
    }
    await onConfirm({
      scheduledAt: dt.toISO()!,
      timezone,
      reason: reason || undefined,
    });
  };

  const previewDt = getScheduledAt();
  const weeks = buildCalendar();
  const today = DateTime.now().startOf('day');

  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-400" />
            <h2 className="font-semibold text-sm">{title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Timezone */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Timezone
            </label>
            <select
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
            >
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setViewDate(v => v.minus({ months: 1 }))}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">
                {viewDate.toFormat('MMMM yyyy')}
              </span>
              <button
                onClick={() => setViewDate(v => v.plus({ months: 1 }))}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Days */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const isCurrentMonth = day.month === viewDate.month;
                  const isSelected = selectedDate?.toISODate() === day.toISODate();
                  const isPast = day < today;
                  const isToday = day.toISODate() === today.toISODate();

                  return (
                    <button
                      key={di}
                      onClick={() => handleDateSelect(day)}
                      disabled={isPast}
                      className={`
                        h-8 w-full rounded-lg text-xs font-medium transition-all
                        ${!isCurrentMonth ? 'opacity-30' : ''}
                        ${isPast ? 'cursor-not-allowed opacity-30' : 'hover:bg-muted'}
                        ${isSelected ? 'bg-violet-600 text-white hover:bg-violet-500' : ''}
                        ${isToday && !isSelected ? 'border border-violet-500/40' : ''}
                      `}
                    >
                      {day.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Time */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Time
            </label>
            <div className="flex gap-2">
              <select
                className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                value={hour}
                onChange={e => setHour(parseInt(e.target.value))}
              >
                {hourOptions.map(h => (
                  <option key={h} value={h}>
                    {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                  </option>
                ))}
              </select>
              <select
                className="w-24 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                value={minute}
                onChange={e => setMinute(parseInt(e.target.value))}
              >
                {minuteOptions.map(m => (
                  <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          {previewDt && (
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2 text-sm text-center">
              <span className="font-semibold text-violet-300">{previewDt.toFormat("EEEE, d MMM yyyy · h:mm a")}</span>
              <span className="text-muted-foreground ml-1.5">{timezone}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!selectedDate || isLoading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
            >
              {isLoading ? 'Scheduling…' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
