'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw, Clock, PlayCircle, AlertTriangle } from 'lucide-react';
import { useAgentRun } from '@/lib/hooks/use-agent-run';
import { useAgentEvents } from '@/lib/hooks/use-agent-events';
import { WorkflowPipeline } from '@/components/dashboard/workflow-pipeline';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { LLMActivityPanel } from '@/components/dashboard/llm-activity-panel';
import { ToolActivityPanel } from '@/components/dashboard/tool-activity-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDateTime } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { AgentStep } from '@evolvr/types';

function durationStr(startedAt: string, completedAt: string | null) {
  if (!completedAt) return 'In progress';
  const secs = Math.floor((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

interface PageProps {
  params: { id: string };
}

export default function RunDetailPage({ params }: PageProps) {
  const { id: runId } = params;
  const { runDetail, isLoading } = useAgentRun(runId);
  const { events, connectionState } = useAgentEvents(runId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!runDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <p className="font-medium text-muted-foreground">Run not found</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/dashboard/agent/runs"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back to history</Link>
        </Button>
      </div>
    );
  }

  const { run, steps } = runDetail;

  // Map AgentStep to the shape WorkflowPipeline expects
  const pipelineSteps = steps.map((s: AgentStep) => ({
    step: s.stepType,
    status: s.status,
    attemptNumber: s.attemptNumber,
    maxAttempts: s.maxAttempts,
    error: s.errorMessage,
    timestamp: s.startedAt,
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="text-xs h-7">
          <Link href="/dashboard/agent/runs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            History
          </Link>
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-lg font-bold capitalize">
          {run.runType?.replace(/_/g, ' ')} — {formatDateTime(run.startedAt)}
        </h2>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ml-auto',
          run.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          run.status === 'failed'    ? 'bg-red-50 text-red-700 border-red-200'             :
          run.status === 'running'   ? 'bg-blue-50 text-blue-700 border-blue-200'          :
          'bg-slate-50 text-slate-600 border-slate-200',
        )}>
          {run.status}
        </span>
      </div>

      {/* Run metadata */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Started',   value: formatDateTime(run.startedAt) },
              { label: 'Duration',  value: durationStr(run.startedAt, run.completedAt) },
              { label: 'Steps',     value: steps.length },
              { label: 'Retries',   value: run.retryCount ?? 0 },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-bold mt-0.5">{String(value)}</p>
              </div>
            ))}
          </div>
          {run.errorMessage && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Error</p>
              <p className="text-xs text-red-600 font-mono break-all">
                {typeof run.errorMessage === 'string' ? run.errorMessage : JSON.stringify(run.errorMessage)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActivityTimeline events={events} connectionState={connectionState} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LLMActivityPanel events={events} />
            <ToolActivityPanel apiLogs={[]} />
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowPipeline steps={pipelineSteps} />
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Generated Prompts (Failed Media) */}
      <RunPromptsSection runId={run.id} />

    </div>
  );
}

// ── Additional Section Component ──────────────────────────────────────────────

import { useUngeneratedPrompts } from '@/lib/hooks/use-ungenerated-prompts';

function RunPromptsSection({ runId }: { runId: string }) {
  const { groups, isLoading } = useUngeneratedPrompts();
  
  if (isLoading) return null;
  
  const group = groups.find((g: any) => g.run.id === runId);
  if (!group || group.ideas.length === 0) return null;

  return (
    <Card className="border-orange-200 shadow-sm mt-6">
      <CardHeader className="bg-orange-50/50 pb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-lg">Failed Media Generations</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          The agent successfully generated these prompts, but media generation failed. You can use these prompts to manually create the content.
        </p>
      </CardHeader>
      <CardContent className="p-0 divide-y">
        {group.ideas.map((idea: any) => (
          <div key={idea.id} className="p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h4 className="font-semibold">{idea.concept}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{idea.caption}</p>
              </div>
              <span className="shrink-0 max-w-xs text-right inline-flex flex-col gap-1 items-end rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                <span>{idea.lastFailure?.errorCategory?.replace(/_/g, ' ') || 'Generation Failed'}</span>
                {(!idea.lastFailure && idea.needsAttentionReason) && (
                  <span className="text-[10px] font-normal leading-tight opacity-80">{idea.needsAttentionReason}</span>
                )}
              </span>
            </div>
            
            {idea.prompts?.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {idea.prompts[0].assetType.replace(/_/g, ' ')} Prompt
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigator.clipboard.writeText(idea.prompts[0].promptText)}>
                    Copy Prompt
                  </Button>
                </div>
                <p className="text-sm font-mono text-slate-700 whitespace-pre-wrap">
                  {idea.prompts[0].promptText}
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
