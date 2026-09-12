'use client';

import React, { useState } from 'react';
import {
  PlayCircle, Loader2, PauseCircle, StopCircle, RefreshCw,
  Cpu, Brain, CheckCircle2, XCircle, Circle, Network, TrendingUp,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAgentStatus }    from '@/lib/hooks/use-agent-status';
import { useAgentEvents }    from '@/lib/hooks/use-agent-events';
import { useStrategy }       from '@/lib/hooks/use-strategy';
import { CurrentActionCard } from '@/components/dashboard/current-action-card';
import { WorkflowPipeline }  from '@/components/dashboard/workflow-pipeline';
import { ActivityTimeline }  from '@/components/dashboard/activity-timeline';
import { NextActionCard }    from '@/components/dashboard/next-action-card';
import { UpcomingTasksCard } from '@/components/dashboard/upcoming-tasks-card';
import { RetryStatusCard }   from '@/components/dashboard/retry-status-card';
import { AgentHealthCard }   from '@/components/dashboard/agent-health-card';
import { LLMActivityPanel }  from '@/components/dashboard/llm-activity-panel';
import { ToolActivityPanel } from '@/components/dashboard/tool-activity-panel';
import { AgentStateBadge }   from '@/components/dashboard/agent-state-badge';
import { ContentMixChart }   from '@/components/dashboard/content-mix-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button }     from '@/components/ui/button';
import { Skeleton }   from '@/components/ui/skeleton';
import { Progress }   from '@/components/ui/progress';
import { cn, formatDateTime } from '@/lib/utils';
import { toast }      from '@/lib/hooks/use-toast';
import type { AgentDecision } from '@evolvr/types';

// ── Decision panel row ────────────────────────────────────────────────────────

const DECISION_ICONS: Record<string, React.ElementType> = {
  GENERATE_CONTENT_PLAN: Network,
  REVISE_STRATEGY:       TrendingUp,
  RUN_RESEARCH:          Brain,
  SCHEDULE_POST:         PlayCircle,
  PUBLISH_POST:          CheckCircle2,
  CREATE_EXPERIMENT:     Cpu,
  RECORD_INSIGHT:        Brain,
  UPDATE_CONTENT_MIX:    TrendingUp,
};

function DecisionRow({ decision }: { decision: AgentDecision }) {
  const [open, setOpen] = useState(false);
  const Icon = DECISION_ICONS[decision.decisionType] ?? Brain;
  const confidence = Math.round((decision.confidence ?? 0) * 100);

  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex gap-3 py-3 text-left hover:bg-muted/30 transition-colors px-1 rounded"
      >
        <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0 h-fit mt-0.5">
          <Icon className="h-3 w-3 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{decision.decisionType.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{formatDateTime(decision.createdAt)}</span>
          </div>
          {decision.reasoning && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{decision.reasoning}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Progress value={confidence} className="h-1 w-12" />
            <span className="text-[10px] text-muted-foreground">{confidence}% confidence</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-1" />
               : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="mx-1 mb-3 rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
          {decision.reasoning && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Reasoning</p>
              <p className="text-foreground/80 leading-relaxed">{decision.reasoning}</p>
            </div>
          )}
          {Array.isArray(decision.evidence) && decision.evidence.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Evidence</p>
              <p className="text-foreground/60">{decision.evidence.length} data points referenced</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmButton({
  label, icon: Icon, onClick, variant = 'outline', disabled, confirmText,
}: {
  label: string; icon: React.ElementType; onClick: () => void;
  variant?: 'outline' | 'destructive'; disabled?: boolean; confirmText?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="destructive" className="text-xs h-7 px-2" onClick={() => { setConfirming(false); onClick(); }}>
          {confirmText ?? 'Confirm'}
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant={variant} className="text-xs h-7 px-2.5 gap-1.5" disabled={disabled}
      onClick={() => variant === 'destructive' ? setConfirming(true) : onClick()}>
      <Icon className="h-3.5 w-3.5" />{label}
    </Button>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function AgentPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const {
    status, isLoading, isActiveRun,
    triggerDailyCycle, pauseRun, resumeRun, cancelRun, retryStep, refresh,
  } = useAgentStatus();
  const { data: strategyData } = useStrategy();

  const runId = status?.currentRun?.id ?? null;
  const { events, connectionState } = useAgentEvents(runId);

  const [triggering, setTriggering]     = useState(false);
  const [actioning, setActioning]       = useState<string | null>(null);
  const [showTechMode, setShowTechMode] = useState(false);

  if (isLoading) return <AgentPageSkeleton />;
  if (!status) return null;

  const state      = status.state;
  const lastRun    = status.currentRun;
  const steps      = lastRun?.progress ?? [];
  const completed  = steps.filter(s => s.status === 'completed').length;
  const runPct     = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const decisions  = status.recentDecisions ?? [];
  const avgConf    = decisions.length
    ? Math.round(decisions.reduce((a, d) => a + (d.confidence ?? 0), 0) / decisions.length * 100)
    : 0;

  const isRunning  = state === 'RUNNING' || state === 'QUEUED';
  const isRetrying = state === 'RETRYING' || status.currentStep?.status === 'retrying';
  const isPaused   = state === 'PAUSED';
  const isFailed   = state === 'FAILED';
  const isIdle     = !isActiveRun && state !== 'PAUSED';

  async function handle(action: string, fn: () => Promise<void>) {
    setActioning(action);
    try {
      await fn();
      toast({ title: `${action} successful` });
    } catch {
      toast({ variant: 'destructive', title: `${action} failed`, description: 'Please try again.' });
    } finally {
      setActioning(null);
    }
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      await triggerDailyCycle();
      toast({ title: 'Daily cycle started', description: 'The agent has begun a new run.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to start cycle' });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            Agent Control Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring and control of your autonomous AI agent
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="text-xs h-7"
            onClick={() => setShowTechMode(t => !t)}>
            {showTechMode ? 'Normal view' : 'Technical mode'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()} className="h-7 px-2.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          {isIdle && !isFailed && (
            <Button onClick={handleTrigger} disabled={triggering} size="sm" className="h-7 px-3 text-xs">
              {triggering ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />}
              Run Daily Cycle
            </Button>
          )}
          {isRunning && lastRun && (
            <ConfirmButton label="Pause" icon={PauseCircle}
              onClick={() => handle('Pause', () => pauseRun(lastRun.id))}
              disabled={actioning !== null} />
          )}
          {isPaused && lastRun && (
            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => handle('Resume', () => resumeRun(lastRun.id))}>
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />Resume
            </Button>
          )}
          {(isRunning || isPaused) && lastRun && (
            <ConfirmButton label="Cancel" icon={StopCircle} variant="destructive"
              onClick={() => handle('Cancel', () => cancelRun(lastRun.id))}
              disabled={actioning !== null} confirmText="Yes, cancel" />
          )}
        </div>
      </div>

      {/* ── Status banner ────────────────────────────────────────────────── */}
      <div className={cn(
        'rounded-xl border p-4 flex items-center gap-4 flex-wrap',
        isRunning   ? 'bg-blue-50 border-blue-200'    :
        isRetrying  ? 'bg-orange-50 border-orange-200':
        isPaused    ? 'bg-slate-50 border-slate-200'  :
        isFailed    ? 'bg-red-50 border-red-200'      :
        state === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200' :
        'bg-muted/30 border-border',
      )}>
        <AgentStateBadge state={state} size="md" />

        <div className="flex-1 min-w-0">
          {lastRun ? (
            <p className="text-sm text-muted-foreground">
              {lastRun.runType?.replace(/_/g, ' ')} ·{' '}
              started {formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true })}
              {lastRun.lastActivityAt && (
                <> · last activity {formatDistanceToNow(new Date(lastRun.lastActivityAt), { addSuffix: true })}</>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No active run — trigger a cycle to begin</p>
          )}
          {showTechMode && lastRun && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
              runId: {lastRun.id} · retries: {lastRun.retryCount ?? 0}
            </p>
          )}
        </div>

        {isRunning && steps.length > 0 && (
          <div className="flex-1 min-w-[160px] max-w-xs">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{completed}/{steps.length} steps</span>
            </div>
            <Progress value={runPct} className="h-2" />
          </div>
        )}

        {state === 'WAITING' && status.nextAction && (
          <p className="text-xs text-amber-700 font-medium">
            Next: {status.nextAction.jobType.replace(/_/g, ' ')} ·{' '}
            {formatDateTime(status.nextAction.scheduledFor)}
          </p>
        )}
      </div>

      {/* ── Stat row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Decisions Made',   value: decisions.length,    sub: 'this session' },
          { label: 'Avg Confidence',   value: `${avgConf}%`,       sub: 'across decisions', accent: 'text-emerald-600' },
          { label: 'Strategy',         value: strategyData?.active ? `v${strategyData.active.versionNumber}` : 'None',
            sub: strategyData?.active ? `${(strategyData.active.confidence * 100).toFixed(0)}% confidence` : 'No active strategy',
            accent: strategyData?.active ? 'text-purple-600' : undefined },
          { label: 'API Calls',        value: status.recentApiLogs?.length ?? 0, sub: 'recent outward' },
        ].map(({ label, value, sub, accent }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className={cn('text-2xl font-bold mt-1 tracking-tight', accent ?? 'text-foreground')}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2/3 — Activity */}
        <div className="lg:col-span-2 space-y-6">

          {/* Current action + Workflow pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrentActionCard currentStep={status.currentStep} state={state} />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Workflow Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                {steps.length > 0 ? (
                  <WorkflowPipeline steps={steps} compact />
                ) : (
                  <p className="text-xs text-muted-foreground">No steps recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Retry card — only when needed */}
          {(isRetrying || isFailed) && (
            <RetryStatusCard
              currentStep={status.currentStep}
              onRetry={status.currentStep && retryStep
                ? () => retryStep(status.currentStep!.stepType)
                : undefined}
              onViewError={() => {}}
            />
          )}

          {/* Activity Timeline (SSE + fallback) */}
          <ActivityTimeline
            events={events}
            connectionState={connectionState}
            staticEvents={steps.flatMap(s => s.logs?.map(l => ({ message: l, timestamp: s.timestamp ?? '', level: 'info' })) ?? [])}
          />

          {/* LLM + Tool panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LLMActivityPanel
              events={events}
              apiLogs={status.recentApiLogs}
            />
            <ToolActivityPanel apiLogs={status.recentApiLogs} />
          </div>

          {/* Active strategy */}
          {strategyData?.active && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Active Strategy
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Version {strategyData.active.versionNumber} ·{' '}
                      Confidence {(strategyData.active.confidence * 100).toFixed(0)}%
                    </CardDescription>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Content Mix</p>
                    <ContentMixChart contentMix={strategyData.active.contentMix} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Cadence</p>
                    {strategyData.active.cadence && Object.entries(strategyData.active.cadence).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                        <span className="text-muted-foreground capitalize text-[11px]">
                          {k.replace(/([A-Z])/g, ' $1').replace('Per Week', '/wk')}
                        </span>
                        <span className="font-semibold text-xs">{String(v)}</span>
                      </div>
                    ))}
                    {strategyData.active.rationale && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Rationale</p>
                        <p className="text-xs text-muted-foreground line-clamp-4">{strategyData.active.rationale}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Errors panel */}
          {status.recentErrors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Recent Errors
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-semibold">
                    {status.recentErrors.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {status.recentErrors.map((err, i) => (
                    <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-xs font-mono text-red-700 break-all leading-relaxed">{err.message}</p>
                      <p className="text-[10px] text-red-400 mt-1.5">
                        {formatDistanceToNow(new Date(err.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1/3 — Control panel */}
        <div className="space-y-6">

          {/* Next action */}
          <NextActionCard nextAction={status.nextAction} />

          {/* Upcoming tasks */}
          <UpcomingTasksCard tasks={status.upcomingActions} />

          {/* Decisions feed */}
          <Card className="max-h-[520px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Agent Decisions
                {decisions.length > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold">
                    {decisions.length}
                  </span>
                )}
              </CardTitle>
              <CardDescription>What the agent decided and why</CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pb-0">
              {decisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Brain className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No decisions logged yet</p>
                </div>
              ) : (
                decisions.slice(0, 10).map(d => <DecisionRow key={d.id} decision={d} />)
              )}
            </CardContent>
          </Card>

          {/* Health */}
          <AgentHealthCard isActive={isActiveRun} />

          {/* System info — only in tech mode */}
          {showTechMode && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">System Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { label: 'Run ID',       value: lastRun?.id ?? 'None' },
                    { label: 'Run Type',     value: lastRun?.runType?.replace(/_/g, ' ') ?? 'None' },
                    { label: 'Strategy',     value: strategyData?.active ? `v${strategyData.active.versionNumber}` : 'None' },
                    { label: 'Poll interval',value: isActiveRun ? '3s' : '30s' },
                    { label: 'SSE state',    value: connectionState },
                    { label: 'Events',       value: events.length },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-semibold text-[11px] max-w-[160px] truncate text-right" title={String(value)}>
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
