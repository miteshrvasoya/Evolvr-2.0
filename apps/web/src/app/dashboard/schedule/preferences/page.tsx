'use client';

import { useState } from 'react';
import {
  Calendar, Settings2, Save, ArrowLeft, Clock,
  Plus, Trash2, Info
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSchedulingPreferences } from '@/lib/hooks/use-schedule';
import { useToast } from '@/lib/hooks/use-toast';

// Common IANA timezones
const COMMON_TIMEZONES = [
  { label: 'UTC',                      value: 'UTC' },
  { label: 'America/New_York (EST)',    value: 'America/New_York' },
  { label: 'America/Chicago (CST)',     value: 'America/Chicago' },
  { label: 'America/Denver (MST)',      value: 'America/Denver' },
  { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
  { label: 'America/Sao_Paulo (BRT)',   value: 'America/Sao_Paulo' },
  { label: 'Europe/London (GMT)',       value: 'Europe/London' },
  { label: 'Europe/Paris (CET)',        value: 'Europe/Paris' },
  { label: 'Europe/Istanbul (TRT)',     value: 'Europe/Istanbul' },
  { label: 'Asia/Dubai (GST)',          value: 'Asia/Dubai' },
  { label: 'Asia/Kolkata (IST)',        value: 'Asia/Kolkata' },
  { label: 'Asia/Singapore (SGT)',      value: 'Asia/Singapore' },
  { label: 'Asia/Tokyo (JST)',          value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (CST)',       value: 'Asia/Shanghai' },
  { label: 'Australia/Sydney (AEDT)',   value: 'Australia/Sydney' },
];

const DEFAULT_WINDOWS = [
  { label: 'morning',   start: '08:00', end: '10:00' },
  { label: 'afternoon', start: '12:00', end: '14:00' },
  { label: 'evening',   start: '18:00', end: '21:00' },
];

export default function SchedulingPreferencesPage() {
  const { prefs, isLoading, isSaving, save } = useSchedulingPreferences();
  const { toast } = useToast();

  const [timezone, setTimezone]   = useState('');
  const [freqType, setFreqType]   = useState<'per_week' | 'per_day'>('per_week');
  const [freqValue, setFreqValue] = useState(5);
  const [minGap, setMinGap]       = useState(4);
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [windows, setWindows] = useState<Array<{ label: string; start: string; end: string }>>(DEFAULT_WINDOWS);
  const [initialized, setInitialized] = useState(false);

  // Sync from loaded prefs once
  if (prefs && !initialized) {
    setTimezone(prefs.timezone ?? 'UTC');
    setFreqType(prefs.postingFrequency?.type ?? 'per_week');
    setFreqValue(prefs.postingFrequency?.value ?? 5);
    setMinGap(prefs.minGapHours ?? 4);
    setMaxPerDay(prefs.maxPostsPerDay ?? 2);
    setWindows(prefs.preferredWindows ?? DEFAULT_WINDOWS);
    setInitialized(true);
  }

  const handleSave = async () => {
    try {
      await save({
        timezone,
        postingFrequency: { type: freqType, value: freqValue },
        preferredWindows: windows,
        minGapHours: minGap,
        maxPostsPerDay: maxPerDay,
      });
      toast({ title: 'Preferences saved', description: 'Scheduling preferences updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save preferences.' });
    }
  };

  const addWindow = () => {
    setWindows(w => [...w, { label: `window-${w.length + 1}`, start: '09:00', end: '11:00' }]);
  };

  const removeWindow = (i: number) => {
    setWindows(w => w.filter((_, idx) => idx !== i));
  };

  const updateWindow = (i: number, field: 'label' | 'start' | 'end', val: string) => {
    setWindows(w => w.map((win, idx) => idx === i ? { ...win, [field]: val } : win));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-10 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
          <Link href="/dashboard/schedule"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back to Schedule</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-medium text-muted-foreground">Configuration</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Scheduling Preferences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define your posting rhythm. These rules guide AI recommendations and conflict detection.
        </p>
      </div>

      {/* Timezone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timezone</CardTitle>
          <CardDescription>All scheduled times will be shown in this timezone.</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
          >
            {COMMON_TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Posting Frequency */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Posting Frequency</CardTitle>
          <CardDescription>How often should content be published?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1} max={30}
              value={freqValue}
              onChange={e => setFreqValue(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <span className="text-sm text-muted-foreground">posts</span>
            <select
              value={freqType}
              onChange={e => setFreqType(e.target.value as any)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="per_week">per week</option>
              <option value="per_day">per day</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Posting Constraints */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Posting Constraints</CardTitle>
          <CardDescription>Prevent posts from being scheduled too close together.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Minimum gap between posts</p>
              <p className="text-xs text-muted-foreground">Hours required between consecutive posts</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={48}
                value={minGap}
                onChange={e => setMinGap(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Max posts per day</p>
              <p className="text-xs text-muted-foreground">Hard cap on daily publishing</p>
            </div>
            <input
              type="number" min={1} max={10}
              value={maxPerDay}
              onChange={e => setMaxPerDay(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preferred Windows */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preferred Publishing Windows</CardTitle>
          <CardDescription>
            Time ranges the AI will prefer when generating schedule recommendations.
            Historical engagement data will further refine these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {windows.map((win, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={win.label}
                onChange={e => updateWindow(i, 'label', e.target.value)}
                placeholder="Label"
                className="w-28 h-8 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <input
                type="time"
                value={win.start}
                onChange={e => updateWindow(i, 'start', e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="time"
                value={win.end}
                onChange={e => updateWindow(i, 'end', e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              {windows.length > 1 && (
                <button
                  onClick={() => removeWindow(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={addWindow}
            className="text-xs text-muted-foreground"
            disabled={windows.length >= 5}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Window
          </Button>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 mt-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              The AI uses your account&apos;s historical engagement patterns alongside these preferences.
              If you have limited data, preferences are weighted more heavily.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
        >
          {isSaving
            ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving…</>
            : <><Save className="h-3.5 w-3.5" />Save Preferences</>
          }
        </Button>
      </div>
    </div>
  );
}
