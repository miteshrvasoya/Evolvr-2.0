'use client';

import { PlayCircle, Loader2, AlertCircle, Clock, Bot } from 'lucide-react';
import { useState } from 'react';
import { useAgentStatus } from '@/lib/hooks/use-agent-status';
import { useStrategy } from '@/lib/hooks/use-strategy';
import { AgentProgressSteps } from '@/components/dashboard/agent-progress-steps';
import { AgentStateBadge, stateConfig } from '@/components/dashboard/agent-state-badge';
import { ContentMixChart } from '@/components/dashboard/content-mix-chart';
import { DecisionLogEntry } from '@/components/dashboard/decision-log-entry';
import { ExperimentRow } from '@/components/dashboard/experiment-row';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';

export default function AgentPage() {
  const { status, isLoading, triggerDailyCycle } = useAgentStatus();
  const { data: strategyData } = useStrategy();
  const [triggering, setTriggering] = useState(false);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!status) return null;

  const stateDesc = stateConfig[status.state];

  return (
    <div className="space-y-6">
      {/* Header & Trigger */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Agent Control Center</h2>
          <Button onClick={handleTrigger} disabled={status?.state === 'running' || triggering}>
            {triggering ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Run Daily Cycle Now
          </Button>
        </div>

        {status && (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Agent Status:</span>
              <AgentStateBadge state={status.state} />
              <span className="text-sm text-muted-foreground ml-2">
                {status.currentRun
                  ? `Currently running: ${status.currentRun.runType.replace(/_/g, ' ')} (started ${formatDateTime(status.currentRun.startedAt)})`
                  : 'Idle'}
              </span>
            </div>
            {status.currentRun?.progress && status.currentRun.progress.length > 0 && (
              <AgentProgressSteps steps={status.currentRun.progress} />
            )}
          </div>
        )}
      </div>

      {/* Strategy + Decisions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {strategyData?.active && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Strategy</CardTitle>
              <CardDescription>
                v{strategyData.active.versionNumber} · Confidence{' '}
                {(strategyData.active.confidence * 100).toFixed(0)}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentMixChart contentMix={strategyData.active.contentMix} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {status.recentDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions yet</p>
            ) : (
              status.recentDecisions.slice(0, 5).map((d) => (
                <DecisionLogEntry key={d.id} decision={d} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs + Errors */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.scheduledJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled jobs</p>
            ) : (
              <ul className="space-y-2">
                {status.scheduledJobs.slice(0, 5).map((job) => (
                  <li key={job.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {job.jobType.replace(/-/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(job.scheduledFor)}
                      </p>
                    </div>
                    <Badge variant={job.status === 'pending' ? 'secondary' : 'info'}>
                      {job.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent errors 🎉</p>
            ) : (
              <ul className="space-y-2">
                {status.recentErrors.slice(0, 5).map((err, i) => (
                  <li key={i} className="border-b pb-2 last:border-0">
                    <p className="text-sm text-destructive">{err.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(err.timestamp)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Experiments */}
      {strategyData?.experiments && strategyData.experiments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Experiments</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Name</th>
                  <th className="pb-2 text-left font-medium">Variable</th>
                  <th className="pb-2 text-left font-medium">Primary Metric</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {strategyData.experiments.map((exp) => (
                  <ExperimentRow key={exp.id} experiment={exp} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Outward Network Logs */}
      {status.recentApiLogs && status.recentApiLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outward Network Logs (LLM Calls)</CardTitle>
            <CardDescription>Recent API calls made by the Agent to external providers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 font-mono text-[10px] sm:text-xs rounded p-4 max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-green-900 text-left text-green-600">
                    <th className="pb-2 pr-4 font-normal">Method</th>
                    <th className="pb-2 pr-4 font-normal">URL</th>
                    <th className="pb-2 pr-4 font-normal">Status</th>
                    <th className="pb-2 pr-4 font-normal">Latency</th>
                    <th className="pb-2 font-normal">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {status.recentApiLogs.map((log, i) => (
                    <tr key={i} className="border-b border-green-900/30">
                      <td className="py-2 pr-4 font-bold">{log.method}</td>
                      <td className="py-2 pr-4 truncate max-w-[200px]" title={log.url}>{log.url}</td>
                      <td className={cn("py-2 pr-4", log.statusCode >= 400 ? "text-red-400" : "text-green-400")}>
                        {log.statusCode}
                      </td>
                      <td className="py-2 pr-4">{log.latencyMs}ms</td>
                      <td className="py-2 text-green-600">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
