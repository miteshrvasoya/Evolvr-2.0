'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, RefreshCw, Clock, PlayCircle,
  ChevronRight, Bot, AlertCircle,
} from 'lucide-react';
import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDateTime } from '@/lib/utils';
import { formatDistanceToNow, formatDuration, intervalToDuration, format, isToday, isYesterday } from 'date-fns';
import type { AgentRun } from '@evolvr/types';

interface RunsResponse {
  runs: AgentRun[];
}

const fetcher = (path: string) => apiClient.get<RunsResponse>(path);

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'failed':    return <XCircle      className="h-4 w-4 text-red-500" />;
    case 'retrying':  return <RefreshCw    className="h-4 w-4 text-orange-400 animate-spin" />;
    case 'running':
    case 'queued':    return <PlayCircle   className="h-4 w-4 text-blue-500" />;
    case 'cancelled': return <XCircle      className="h-4 w-4 text-slate-400" />;
    default:          return <Clock        className="h-4 w-4 text-slate-400" />;
  }
}

function durationStr(startedAt: string, completedAt: string | null) {
  if (!completedAt) return '—';
  const secs = Math.floor((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

function groupByDate(runs: AgentRun[]): { label: string; runs: AgentRun[] }[] {
  const map = new Map<string, AgentRun[]>();
  for (const run of runs) {
    const d = new Date(run.startedAt);
    const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, dd MMM');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(run);
  }
  return Array.from(map.entries()).map(([label, runs]) => ({ label, runs }));
}

export default function AgentRunsPage() {
  // The account-level runs endpoint requires accountId — use agent/status to get it
  const { data, isLoading } = useSWR('/api/agent/status', (p) => apiClient.get<any>(p));
  const accountId = data?.currentRun?.socialAccountId ?? null;

  const { data: runsData, isLoading: runsLoading } = useSWR(
    accountId ? `/api/accounts/${accountId}/agent/runs` : null,
    fetcher,
  );

  const runs = runsData?.runs ?? [];
  const groups = groupByDate(runs);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agent Run History</h2>
        <p className="text-sm text-muted-foreground mt-1">
          All agent runs for this account, newest first.
        </p>
      </div>

      {(isLoading || runsLoading) ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : runs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="font-medium text-muted-foreground">No runs yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Trigger a daily cycle from the Agent Control Center to begin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, runs }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
              <div className="space-y-2">
                {runs.map(run => (
                  <Link key={run.id} href={`/dashboard/agent/runs/${run.id}`}>
                    <div className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors cursor-pointer group">
                      <RunStatusIcon status={run.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">
                            {run.runType?.replace(/_/g, ' ')}
                          </span>
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize',
                            run.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            run.status === 'failed'    ? 'bg-red-50 text-red-700 border-red-200'             :
                            run.status === 'running'   ? 'bg-blue-50 text-blue-700 border-blue-200'          :
                            run.status === 'retrying'  ? 'bg-orange-50 text-orange-700 border-orange-200'    :
                            'bg-slate-50 text-slate-600 border-slate-200',
                          )}>
                            {run.status}
                          </span>
                          {run.retryCount > 0 && (
                            <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                              <RefreshCw className="h-3 w-3" /> {run.retryCount} retries
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(run.startedAt)}
                          {run.completedAt && (
                            <> · {durationStr(run.startedAt, run.completedAt)}</>
                          )}
                        </p>
                        {run.errorMessage && (
                          <p className="text-xs text-red-500 mt-0.5 font-mono truncate">
                            {typeof run.errorMessage === 'string' ? run.errorMessage : 'Run failed'}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
