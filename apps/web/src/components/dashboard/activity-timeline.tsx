'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, RefreshCw, AlertCircle, Info, Zap,
  Brain, Wrench, FileText, TrendingUp, BarChart3, Lightbulb,
  ChevronDown, ChevronRight, Wifi, WifiOff, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import type { AgentEventItem, ConnectionState } from '@/lib/hooks/use-agent-events';

// ── Filter types ─────────────────────────────────────────────────────────────

type FilterType = 'all' | 'errors' | 'retries' | 'llm' | 'tools' | 'content' | 'strategy' | 'analytics' | 'learning';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'errors',   label: 'Errors'   },
  { key: 'retries',  label: 'Retries'  },
  { key: 'llm',      label: 'LLM'      },
  { key: 'tools',    label: 'Tools'    },
  { key: 'content',  label: 'Content'  },
  { key: 'strategy', label: 'Strategy' },
  { key: 'analytics',label: 'Analytics'},
  { key: 'learning', label: 'Learning' },
];

function matchesFilter(evt: AgentEventItem, filter: FilterType): boolean {
  if (filter === 'all') return true;
  const t = evt.eventType.toLowerCase();
  const m = evt.message.toLowerCase();
  switch (filter) {
    case 'errors':    return evt.level === 'error' || t.includes('fail') || t.includes('error');
    case 'retries':   return t.includes('retry') || t.includes('retrying') || t.includes('attempt');
    case 'llm':       return t.includes('llm') || t.includes('openrouter') || t.includes('model');
    case 'tools':     return t.includes('tool') || t.includes('api') || t.includes('instagram');
    case 'content':   return t.includes('content') || t.includes('generate') || t.includes('script');
    case 'strategy':  return t.includes('strategy') || t.includes('revision');
    case 'analytics': return t.includes('analytics') || t.includes('metric') || t.includes('insight');
    case 'learning':  return t.includes('learn') || t.includes('learning');
    default: return true;
  }
}

// ── Event icon + color ────────────────────────────────────────────────────────

function eventIcon(evt: AgentEventItem) {
  const t = evt.eventType.toLowerCase();
  if (evt.level === 'error' || t.includes('fail'))    return { Icon: XCircle,      cls: 'text-red-500'     };
  if (t.includes('retry') || t.includes('retrying'))  return { Icon: RefreshCw,    cls: 'text-orange-500'  };
  if (t.includes('complete') || t.includes('success'))return { Icon: CheckCircle2, cls: 'text-emerald-500' };
  if (t.includes('llm') || t.includes('model'))       return { Icon: Brain,        cls: 'text-purple-500'  };
  if (t.includes('tool') || t.includes('api'))        return { Icon: Wrench,       cls: 'text-blue-500'    };
  if (t.includes('content'))                          return { Icon: FileText,     cls: 'text-pink-500'    };
  if (t.includes('strategy'))                         return { Icon: TrendingUp,   cls: 'text-indigo-500'  };
  if (t.includes('analytics') || t.includes('metric'))return { Icon: BarChart3,   cls: 'text-cyan-500'    };
  if (t.includes('learn'))                            return { Icon: Lightbulb,    cls: 'text-yellow-500'  };
  if (t.includes('publish'))                          return { Icon: Zap,          cls: 'text-emerald-600' };
  if (evt.level === 'warn')                           return { Icon: AlertCircle,  cls: 'text-amber-500'   };
  return { Icon: Info, cls: 'text-slate-400' };
}

// ── Single event row ──────────────────────────────────────────────────────────

function EventRow({ evt }: { evt: AgentEventItem }) {
  const [open, setOpen] = useState(false);
  const { Icon, cls } = eventIcon(evt);
  const hasMetadata = evt.metadata && Object.keys(evt.metadata).length > 0;
  const timeStr = format(new Date(evt.createdAt), 'HH:mm:ss');

  return (
    <div className={cn(
      'group relative',
      evt.level === 'error' && 'bg-red-50/50',
    )}>
      <button
        onClick={() => hasMetadata && setOpen(o => !o)}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
          hasMetadata && 'hover:bg-muted/40 cursor-pointer',
          !hasMetadata && 'cursor-default',
        )}
      >
        <span className="text-[10px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 pt-0.5 tabular-nums">
          {timeStr}
        </span>
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', cls)} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug">{evt.message}</p>
          <p className={cn(
            'text-[10px] mt-0.5 uppercase tracking-wide font-semibold',
            evt.level === 'error' ? 'text-red-400' :
            evt.level === 'warn'  ? 'text-amber-400' : 'text-muted-foreground/50',
          )}>
            {evt.eventType.replace(/_/g, ' ')}
          </p>
        </div>
        {hasMetadata && (
          <span className="flex-shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>

      {open && hasMetadata && (
        <div className="mx-4 mb-3 rounded-lg border bg-muted/30 p-3 text-xs font-mono space-y-1">
          {Object.entries(evt.metadata).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground min-w-[80px] flex-shrink-0">{k}:</span>
              <span className="break-all text-foreground/80">{JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Connection badge ─────────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: ConnectionState }) {
  switch (state) {
    case 'connected':
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
          <Wifi className="h-3 w-3" /> Live
        </span>
      );
    case 'connecting':
    case 'reconnecting':
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
          <Loader2 className="h-3 w-3 animate-spin" />
          {state === 'reconnecting' ? 'Reconnecting' : 'Connecting'}
        </span>
      );
    case 'disconnected':
    default:
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
          <WifiOff className="h-3 w-3" /> Offline
        </span>
      );
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface ActivityTimelineProps {
  events: AgentEventItem[];
  connectionState: ConnectionState;
  /** Fallback static events from /agent/status when SSE is unavailable */
  staticEvents?: Array<{ message: string; timestamp: string; level?: string }>;
  className?: string;
}

export function ActivityTimeline({ events, connectionState, staticEvents = [], className }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = events.length > 0 ? events : staticEvents.map((e, i) => ({
      id: String(i),
      runId: '',
      stepId: null,
      eventType: 'LOG',
      level: (e.level ?? 'info') as AgentEventItem['level'],
      message: e.message,
      metadata: {},
      createdAt: e.timestamp,
    }));

    if (filter !== 'all') list = list.filter(e => matchesFilter(e, filter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q),
      );
    }
    return [...list].reverse(); // newest first
  }, [events, staticEvents, filter, search]);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-0 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-semibold">Live Activity</CardTitle>
          <ConnectionBadge state={connectionState} />
        </div>

        {/* Filter bar */}
        <div className="flex gap-1 flex-wrap mt-3 pb-3 border-b">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors',
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="pt-2 pb-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full text-xs bg-muted/40 border rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Info className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No events</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {connectionState === 'connected'
                ? 'Activity will appear here when the agent runs.'
                : 'Connecting to event stream…'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(evt => (
              <EventRow key={evt.id} evt={evt} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
