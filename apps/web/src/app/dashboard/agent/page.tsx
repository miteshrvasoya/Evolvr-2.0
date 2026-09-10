'use client';

import {
  PlayCircle, Loader2, AlertCircle, Clock, Bot, Zap, Brain,
  CheckCircle2, XCircle, Circle, RefreshCw, Activity, Cpu,
  Network, FileText, TrendingUp, Shield, BarChart3,
  WifiOff, Terminal, Database, Wifi
} from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAgentStatus } from '@/lib/hooks/use-agent-status';
import { useStrategy } from '@/lib/hooks/use-strategy';
import { ContentMixChart } from '@/components/dashboard/content-mix-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import type { AgentStep, AgentDecision } from '@evolvr/types';

// ─── State config ──────────────────────────────────────────────────────────
const STATE_CONFIG: Record<string, {
  label: string; color: string; bg: string; dot: string; pulse: boolean;
}> = {
  running:          { label: 'Running',         color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500',   pulse: true  },
  idle:             { label: 'Idle',            color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400',  pulse: false },
  IDLE:             { label: 'Idle',            color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400',  pulse: false },
  FAILED:           { label: 'Failed',          color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       dot: 'bg-red-500',    pulse: false },
  BLOCKED:          { label: 'Blocked',         color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', pulse: false },
  WAITING_APPROVAL: { label: 'Needs Approval',  color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', pulse: true  },
  OBSERVING:        { label: 'Observing',       color: 'text-cyan-600',   bg: 'bg-cyan-50 border-cyan-200',     dot: 'bg-cyan-500',   pulse: true  },
  PLANNING:         { label: 'Planning',        color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500', pulse: true  },
  CREATING:         { label: 'Creating',        color: 'text-pink-600',   bg: 'bg-pink-50 border-pink-200',     dot: 'bg-pink-500',   pulse: true  },
};

const DECISION_ICONS: Record<string, React.ElementType> = {
  GENERATE_CONTENT_PLAN: FileText,
  REVISE_STRATEGY:       TrendingUp,
  RUN_RESEARCH:          Brain,
  SCHEDULE_POST:         Clock,
  PUBLISH_POST:          Zap,
  CREATE_EXPERIMENT:     Activity,
  RECORD_INSIGHT:        Database,
  SEND_NOTIFICATION:     Wifi,
  BLOCK_AWAITING_APPROVAL: Shield,
  UPDATE_CONTENT_MIX:    BarChart3,
};

const DECISION_COLORS: Record<string, string> = {
  GENERATE_CONTENT_PLAN:   'text-blue-500 bg-blue-50 border-blue-100',
  REVISE_STRATEGY:         'text-purple-500 bg-purple-50 border-purple-100',
  RUN_RESEARCH:            'text-indigo-500 bg-indigo-50 border-indigo-100',
  SCHEDULE_POST:           'text-green-500 bg-green-50 border-green-100',
  PUBLISH_POST:            'text-emerald-500 bg-emerald-50 border-emerald-100',
  CREATE_EXPERIMENT:       'text-orange-500 bg-orange-50 border-orange-100',
  RECORD_INSIGHT:          'text-cyan-500 bg-cyan-50 border-cyan-100',
  SEND_NOTIFICATION:       'text-slate-500 bg-slate-50 border-slate-100',
  BLOCK_AWAITING_APPROVAL: 'text-yellow-500 bg-yellow-50 border-yellow-100',
  UPDATE_CONTENT_MIX:      'text-pink-500 bg-pink-50 border-pink-100',
};

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accentClass,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accentClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold mt-1 tracking-tight', accentClass ?? 'text-foreground')}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl', accentClass ? 'bg-primary/10' : 'bg-muted')}>
            <Icon className={cn('h-4 w-4', accentClass ?? 'text-muted-foreground')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: AgentStep }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        {step.status === 'running'   && <Loader2    className="h-4 w-4 animate-spin text-blue-500" />}
        {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {step.status === 'failed'    && <XCircle    className="h-4 w-4 text-red-500" />}
        {step.status === 'pending'   && <Circle     className="h-4 w-4 text-muted-foreground/40" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm font-medium',
            step.status === 'running'   ? 'text-blue-600'    :
            step.status === 'completed' ? 'text-emerald-600' :
            step.status === 'failed'    ? 'text-red-600'     : 'text-muted-foreground',
          )}>
            {step.step}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(step.timestamp), { addSuffix: true })}
          </span>
        </div>

        {step.error && (
          <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 font-mono">
            {step.error}
          </div>
        )}

        {step.logs && step.logs.length > 0 && (
          <div className="mt-2 bg-[#0d1117] rounded-lg border border-[#30363d] p-3 font-mono text-[11px] text-green-400 max-h-40 overflow-y-auto space-y-0.5">
            {step.logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[#3fb950] opacity-50 select-none flex-shrink-0 w-5 text-right">{i + 1}</span>
                <span className="break-all leading-relaxed">{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionRow({ decision }: { decision: AgentDecision }) {
  const Icon = DECISION_ICONS[decision.decisionType] ?? Brain;
  const colorClass = DECISION_COLORS[decision.decisionType] ?? 'text-slate-500 bg-slate-50 border-slate-100';
  const confidence = Math.round((decision.confidence ?? 0) * 100);

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <div className={cn('p-2 rounded-lg border flex-shrink-0 h-fit', colorClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">{decision.decisionType.replace(/_/g, ' ')}</span>
          <span className="text-[10px] text-muted-foreground">{formatDateTime(decision.createdAt)}</span>
        </div>
        {decision.reasoning && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{decision.reasoning}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Confidence</span>
            <Progress value={confidence} className="h-1 w-14" />
            <span className="text-[10px] font-semibold">{confidence}%</span>
          </div>
          {Array.isArray(decision.evidence) && decision.evidence.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{decision.evidence.length} evidence pts</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function AgentPage() {
  const { status, isLoading, triggerDailyCycle, refresh } = useAgentStatus();
  const { data: strategyData } = useStrategy();
  const [triggering, setTriggering]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'progress' | 'network'>('progress');

  const isRunning  = status?.state === 'running';
  const stateInfo  = STATE_CONFIG[status?.state ?? 'idle'] ?? STATE_CONFIG.idle;
  const lastRun    = status?.currentRun ?? null;

  const completedSteps = lastRun?.progress?.filter(s => s.status === 'completed').length ?? 0;
  const totalSteps     = lastRun?.progress?.length ?? 0;
  const runProgress    = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const totalDecisions = status?.recentDecisions?.length ?? 0;
  const avgConfidence  = totalDecisions
    ? Math.round(status!.recentDecisions.reduce((a, d) => a + (d.confidence ?? 0), 0) / totalDecisions * 100)
    : 0;

  async function handleTrigger() {
    setTriggering(true);
    try {
      await triggerDailyCycle();
      toast({ title: 'Daily cycle triggered', description: 'The agent has started a new cycle.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not trigger daily cycle.' });
    } finally {
      setTriggering(false);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
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

  if (!status) return null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            Agent Control Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring &amp; control of your AI automation agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isRunning}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isRunning && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={handleTrigger} disabled={isRunning || triggering} size="sm">
            {triggering
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <PlayCircle className="mr-2 h-4 w-4" />}
            Run Daily Cycle
          </Button>
        </div>
      </div>

      {/* Status banner */}
      <div className={cn('rounded-xl border p-4 flex items-center gap-4 flex-wrap', stateInfo.bg)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <div className={cn('h-3 w-3 rounded-full', stateInfo.dot)} />
            {stateInfo.pulse && (
              <div className={cn('absolute inset-0 h-3 w-3 rounded-full animate-ping opacity-60', stateInfo.dot)} />
            )}
          </div>
          <div className="min-w-0">
            <div className={cn('text-sm font-semibold', stateInfo.color)}>{stateInfo.label}</div>
            <div className="text-xs text-muted-foreground truncate">
              {lastRun
                ? `Running: ${(lastRun.runType ?? '').replace(/_/g, ' ')} · started ${formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true })}`
                : 'Agent is idle — trigger a cycle to start'}
            </div>
          </div>
        </div>

        {isRunning && totalSteps > 0 && (
          <div className="flex-1 min-w-[160px] max-w-xs">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{completedSteps}/{totalSteps} steps</span>
            </div>
            <Progress value={runProgress} className="h-2" />
          </div>
        )}

        {isRunning && (
          <Badge variant="outline" className="border-blue-300 text-blue-600 bg-white/60 gap-1.5 animate-pulse">
            <Activity className="h-3 w-3" />
            Live
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Brain}
          label="Decisions Made"
          value={totalDecisions}
          sub="this session"
        />
        <StatCard
          icon={CheckCircle2}
          label="Avg Confidence"
          value={`${avgConfidence}%`}
          sub="across decisions"
          accentClass="text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Strategy"
          value={strategyData?.active ? `v${strategyData.active.versionNumber}` : 'None'}
          sub={strategyData?.active
            ? `${(strategyData.active.confidence * 100).toFixed(0)}% confidence`
            : 'No active strategy'}
          accentClass={strategyData?.active ? 'text-purple-600' : undefined}
        />
        <StatCard
          icon={Network}
          label="API Calls"
          value={status.recentApiLogs?.length ?? 0}
          sub="outward, last 20"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left 2/3 – Activity ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Live activity card with tabs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Live Agent Activity
                </CardTitle>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  {(['progress', 'network'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-md transition-all',
                        activeTab === tab
                          ? 'bg-background shadow text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab === 'progress' ? 'Steps' : 'Network Logs'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'progress' ? (
                lastRun?.progress && lastRun.progress.length > 0 ? (
                  <div className="space-y-5">
                    {lastRun.progress.map((step, i) => <StepRow key={i} step={step} />)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <Bot className="h-12 w-12 text-muted-foreground/20 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Agent is idle</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Click &quot;Run Daily Cycle&quot; to start the agent
                    </p>
                  </div>
                )
              ) : (
                status.recentApiLogs && status.recentApiLogs.length > 0 ? (
                  <div className="bg-[#0d1117] rounded-xl border border-[#30363d] overflow-hidden">
                    {/* Terminal title bar */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#30363d] bg-[#161b22]">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                      </div>
                      <span className="text-[#8b949e] text-xs font-mono ml-2">
                        outward-api-logs — {status.recentApiLogs.length} entries
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full font-mono text-[11px]">
                        <thead>
                          <tr className="text-[#8b949e] border-b border-[#21262d] text-left">
                            <th className="px-4 py-2.5 font-normal">Method</th>
                            <th className="px-4 py-2.5 font-normal">URL</th>
                            <th className="px-4 py-2.5 font-normal">Status</th>
                            <th className="px-4 py-2.5 font-normal">Latency</th>
                            <th className="px-4 py-2.5 font-normal">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {status.recentApiLogs.map((log, i) => (
                            <tr key={i} className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors">
                              <td className="px-4 py-2 text-blue-400 font-bold">{log.method}</td>
                              <td className="px-4 py-2 text-[#c9d1d9] max-w-[260px] truncate" title={log.url}>
                                {log.url}
                              </td>
                              <td className={cn(
                                'px-4 py-2 font-bold',
                                log.statusCode >= 400 ? 'text-red-400' : 'text-green-400',
                              )}>
                                {log.statusCode}
                              </td>
                              <td className="px-4 py-2 text-yellow-400">{log.latencyMs}ms</td>
                              <td className="px-4 py-2 text-[#8b949e]">
                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <WifiOff className="h-12 w-12 text-muted-foreground/20 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No API calls logged yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Outward calls to OpenRouter will appear here
                    </p>
                  </div>
                )
              )}
            </CardContent>
          </Card>

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
                      Version {strategyData.active.versionNumber} &nbsp;·&nbsp;
                      Confidence {(strategyData.active.confidence * 100).toFixed(0)}%
                    </CardDescription>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">Content Mix</p>
                    <ContentMixChart contentMix={strategyData.active.contentMix} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">Weekly Cadence</p>
                    {strategyData.active.cadence && Object.entries(strategyData.active.cadence).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <span className="text-muted-foreground capitalize text-xs">
                          {key.replace(/([A-Z])/g, ' $1').replace('Per Week', '/wk')}
                        </span>
                        <span className="font-semibold text-xs">{String(val)}</span>
                      </div>
                    ))}
                    {strategyData.active.rationale && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Rationale</p>
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
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0.5">
                    {status.recentErrors.length}
                  </Badge>
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

        {/* ── Right 1/3 – Decisions + Jobs + System ──────────────────── */}
        <div className="space-y-6">

          {/* Decision feed */}
          <Card className="max-h-[600px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Agent Decisions
                {totalDecisions > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0.5">{totalDecisions}</Badge>
                )}
              </CardTitle>
              <CardDescription>What the agent decided and why</CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1">
              {status.recentDecisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Brain className="h-10 w-10 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No decisions logged yet</p>
                </div>
              ) : (
                <div>
                  {status.recentDecisions.slice(0, 10).map((d) => (
                    <DecisionRow key={d.id} decision={d} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduled jobs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Scheduled Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status.scheduledJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No scheduled jobs</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {status.scheduledJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border hover:bg-muted/80 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-medium capitalize truncate">
                          {job.jobType.replace(/-/g, ' ')}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(job.scheduledFor)}</p>
                      </div>
                      <div className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2',
                        job.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200',
                      )}>
                        {job.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System info panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                System Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {[
                  { label: 'Agent State',    value: stateInfo.label },
                  { label: 'Run Type',       value: (lastRun?.runType ?? 'None').replace(/_/g, ' ') },
                  { label: 'Active Strategy',value: strategyData?.active ? `v${strategyData.active.versionNumber}` : 'None' },
                  { label: 'Polling Rate',   value: isRunning ? 'Every 3s' : 'Every 30s' },
                  { label: 'Errors Today',   value: status.recentErrors.length },
                  { label: 'API Calls',      value: status.recentApiLogs?.length ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
