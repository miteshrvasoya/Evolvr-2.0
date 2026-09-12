'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow, formatDistance } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CurrentStepInfo } from '@/lib/hooks/use-agent-status';

const STEP_LABELS: Record<string, string> = {
  evaluate_next_action:  'Evaluating next action',
  run_research:          'Running research',
  revise_strategy:       'Revising strategy',
  generate_content:      'Generating content',
  generate_content_plan: 'Generating content plan',
  validate_content:      'Validating content',
  schedule_post:         'Scheduling post',
  publish_post:          'Publishing post',
  collect_analytics:     'Collecting analytics',
  run_learning:          'Learning from performance',
  update_strategy:       'Updating strategy',
};

function humanizeStep(stepType: string) {
  return STEP_LABELS[stepType] ?? stepType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function useCountdown(targetIso: string | null) {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) { setSecs(null); return; }
    const tick = () => setSecs(Math.max(0, Math.round((new Date(targetIso).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return secs;
}

function useElapsed(startedAt: string | null, baseElapsed: number) {
  const [elapsed, setElapsed] = useState(baseElapsed);
  useEffect(() => {
    if (!startedAt) return;
    const base = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    setElapsed(base);
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

function formatSecs(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

interface CurrentActionCardProps {
  currentStep: CurrentStepInfo | null;
  state: string;
  className?: string;
}

export function CurrentActionCard({ currentStep, state, className }: CurrentActionCardProps) {
  const countdown = useCountdown(currentStep?.nextRetryAt ?? null);
  const elapsed   = useElapsed(currentStep?.startedAt ?? null, currentStep?.elapsedSeconds ?? 0);

  const isIdle = !currentStep || ['IDLE', 'COMPLETED', 'CANCELLED'].includes(state);

  if (isIdle) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No active action</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {state === 'COMPLETED' ? 'Cycle completed successfully.' : 'Trigger a cycle to begin.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isRetrying = currentStep.status === 'retrying' || state === 'RETRYING';
  const isFailed   = currentStep.status === 'failed' || state === 'FAILED';
  const isDone     = currentStep.status === 'completed';

  return (
    <Card className={cn(
      'border',
      isRetrying ? 'border-orange-200 bg-orange-50/30' :
      isFailed   ? 'border-red-200 bg-red-50/30'       :
      isDone     ? 'border-emerald-200 bg-emerald-50/30' :
      'border-blue-200 bg-blue-50/30',
      className,
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {isRetrying ? (
            <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />
          ) : isFailed ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          )}
          Current Action
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={cn(
          'font-semibold text-base',
          isRetrying ? 'text-orange-800' :
          isFailed   ? 'text-red-800'    :
          isDone     ? 'text-emerald-800' : 'text-blue-900',
        )}>
          {humanizeStep(currentStep.stepType)}
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">Status</p>
            <p className="font-medium capitalize">{currentStep.status}</p>
          </div>
          {currentStep.maxAttempts > 1 && (
            <div className="space-y-0.5">
              <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">Attempt</p>
              <p className="font-medium">{currentStep.attemptNumber} / {currentStep.maxAttempts}</p>
            </div>
          )}
          {currentStep.startedAt && (
            <div className="space-y-0.5">
              <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">Elapsed</p>
              <p className="font-medium tabular-nums">{formatSecs(elapsed)}</p>
            </div>
          )}
          {isRetrying && countdown !== null && countdown > 0 && (
            <div className="space-y-0.5">
              <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold">Next retry</p>
              <p className="font-medium tabular-nums text-orange-700">{formatSecs(countdown)}</p>
            </div>
          )}
        </div>

        {currentStep.errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-red-700 mb-0.5">
              {isRetrying ? 'Last error' : 'Error'}
            </p>
            <p className="text-xs text-red-600 font-mono break-all">{currentStep.errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
