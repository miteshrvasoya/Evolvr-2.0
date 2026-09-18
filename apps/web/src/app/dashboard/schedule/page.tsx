'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Settings2,
  List, LayoutGrid, AlertTriangle, ArrowRight, Sparkles,
  RefreshCw, Image as ImageIcon, CheckCircle2,
} from 'lucide-react';
import { useScheduleCalendar, useUpcomingSchedules, useScheduleStats } from '@/lib/hooks/use-schedule';
import { ScheduleStatusBadge, MediaStatusBadge } from '@/components/scheduling/schedule-cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Calendar Cell ────────────────────────────────────────────────────────────

function CalendarCell({ day, posts }: { day: DateTime; posts: any[] }) {
  const today  = DateTime.now().startOf('day');
  const isToday = day.toISODate() === today.toISODate();
  const isPast  = day < today;

  return (
    <div className={`
      min-h-24 p-1.5 border-b border-r border-border
      ${isToday ? 'bg-violet-500/5' : ''}
      ${isPast ? 'opacity-60' : ''}
    `}>
      <p className={`
        text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
        ${isToday ? 'bg-violet-600 text-white' : 'text-muted-foreground'}
      `}>
        {day.day}
      </p>
      <div className="space-y-0.5">
        {posts.slice(0, 3).map((post, i) => {
          const dt = DateTime.fromISO(post.scheduledAt);
          const isMissed = post.scheduleStatus === 'MISSED';
          const isPublished = post.status === 'published';
          return (
            <Link
              key={i}
              href={`/dashboard/content/${post.contentIdeaId}`}
              className={`
                block px-1.5 py-0.5 rounded text-xs truncate transition-all
                hover:opacity-80 cursor-pointer
                ${isPublished ? 'bg-emerald-500/20 text-emerald-300' :
                  isMissed    ? 'bg-red-500/20 text-red-300' :
                                'bg-violet-500/20 text-violet-300'}
              `}
            >
              <span className="font-medium">{dt.toFormat('h:mm a')}</span>
              {' '}
              <span className="opacity-80 truncate">{post.hook ?? post.pillar ?? 'Post'}</span>
            </Link>
          );
        })}
        {posts.length > 3 && (
          <p className="text-xs text-muted-foreground px-1">+{posts.length - 3} more</p>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useScheduleCalendar(year, month);

  const startOfMonth = DateTime.fromObject({ year, month, day: 1 });
  const startOfGrid  = startOfMonth.startOf('week');
  const endOfMonth   = startOfMonth.endOf('month');
  const endOfGrid    = endOfMonth.endOf('week');

  // Build grid
  const days: DateTime[] = [];
  let cur = startOfGrid;
  while (cur <= endOfGrid) { days.push(cur); cur = cur.plus({ days: 1 }); }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const postsByDate = new Map<string, any[]>();
  for (const post of data) {
    const key = DateTime.fromISO(post.scheduledAt).toISODate()!;
    const arr = postsByDate.get(key) ?? [];
    arr.push(post);
    postsByDate.set(key, arr);
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            const key = day.toISODate()!;
            const posts = postsByDate.get(key) ?? [];
            const isCurrentMonth = day.month === month;
            return (
              <div key={di} className={!isCurrentMonth ? 'opacity-40' : ''}>
                <CalendarCell day={day} posts={posts} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView() {
  const { data, isLoading, refresh } = useUpcomingSchedules(25);

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );

  if (!data.length) {
    return (
      <Card className="text-center p-8 border-dashed">
        <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">No upcoming posts</p>
        <p className="text-xs text-muted-foreground mt-1">Schedule content from the Content Library</p>
        <Button size="sm" variant="outline" className="mt-4" asChild>
          <Link href="/dashboard/content">Browse Content</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map(post => {
        const dt = DateTime.fromISO(post.scheduledAt).setZone(post.scheduleTimezone ?? 'UTC');
        return (
          <Link key={post.id} href={`/dashboard/content/${post.contentIdeaId}`}>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group">
              {/* Media thumbnail */}
              <div className="h-12 w-12 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {post.mediaUrl ? (
                  <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {post.pillar && <Badge variant="outline" className="text-xs">{post.pillar}</Badge>}
                  {post.format && <Badge variant="outline" className="text-xs opacity-60">{post.format}</Badge>}
                </div>
                <p className="text-sm truncate mt-0.5">{post.hook ?? 'Untitled'}</p>
              </div>

              {/* Schedule info */}
              <div className="text-right shrink-0 space-y-1">
                <p className="text-xs font-semibold">{dt.toFormat('d MMM')}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="h-3 w-3" />{dt.toFormat('h:mm a')}
                </p>
                <ScheduleStatusBadge
                  status={post.scheduleStatus}
                  publishStatus={post.publishJobStatus}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow() {
  const { data } = useScheduleStats();
  const items = [
    { label: 'Scheduled',    value: data.scheduled,    color: 'text-violet-400' },
    { label: 'Published',    value: data.published,    color: 'text-emerald-400' },
    { label: 'Needs Media',  value: data.needsMedia,   color: 'text-amber-400' },
    { label: 'Missed',       value: data.missed,       color: 'text-red-400' },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map(item => (
        <Card key={item.label} className="py-3 px-4">
          <p className={`text-2xl font-bold ${item.color}`}>{item.value ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const now  = DateTime.now();
  const [viewYear,  setViewYear]  = useState(now.year);
  const [viewMonth, setViewMonth] = useState(now.month);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const viewDt = DateTime.fromObject({ year: viewYear, month: viewMonth, day: 1 });

  const prevMonth = () => {
    const prev = viewDt.minus({ months: 1 });
    setViewYear(prev.year); setViewMonth(prev.month);
  };
  const nextMonth = () => {
    const next = viewDt.plus({ months: 1 });
    setViewYear(next.year); setViewMonth(next.month);
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-medium text-muted-foreground">Publishing Schedule</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View, manage, and reschedule your upcoming posts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-2 text-xs">
            <Link href="/dashboard/schedule/preferences">
              <Settings2 className="h-3.5 w-3.5" />Scheduling Prefs
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2 text-xs">
            <Link href="/dashboard/content">
              <Sparkles className="h-3.5 w-3.5" />Schedule Content
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsRow />

      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view === 'calendar' && (
            <>
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-base font-semibold min-w-36 text-center">
                {viewDt.toFormat('MMMM yyyy')}
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => { setViewYear(now.year); setViewMonth(now.month); }}
              >
                Today
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
              view === 'calendar' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />Calendar
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
              view === 'list' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-3.5 w-3.5" />List
          </button>
        </div>
      </div>

      {/* Main Content */}
      {view === 'calendar' ? (
        <CalendarView year={viewYear} month={viewMonth} />
      ) : (
        <ListView />
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Published
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />Missed
        </span>
      </div>
    </div>
  );
}
