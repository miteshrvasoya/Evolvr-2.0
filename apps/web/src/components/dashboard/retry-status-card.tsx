'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { CurrentStepInfo } from '@/lib/hooks/use-agent-status';

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

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}

interface RetryAttempt {
  attemptNumber: number;
  status: 'failed' | 'retrying' | 'running' | 'completed';
  errorMessage?: string | null;
  timestamp?: string | null;
}

interface RetryStatusCardProps {
  currentStep: CurrentStepInfo | null;
  /** History of all attempts for current step, derived from progress */
  attempts?: RetryAttempt[];
  onRetry?: (stepId?: string) => void;
  onViewError?: () => void;
  stepId?: string;
  className?: string;
}

export function RetryStatusCard({
  currentStep, attempts = [], onRetry, onViewError, stepId, className,
}: RetryStatusCardProps) {
  const countdown = useCountdown(currentStep?.nextRetryAt ?? null);

  const isRetrying = currentStep?.status === 'retrying';
  const isFailed   = currentStep?.status === 'failed';
  const isExhausted = isFailed && !currentStep?.retryable;

  if (!currentStep || (!isRetrying && !isFailed)) return null;

  const attempt  = currentStep.attemptNumber;
  const maxAttempts = currentStep.maxAttempts;

  return (
    <Card className={cn(
      'border',
      isExhausted ? 'border-red-300 bg-red-50/30' : 'border-orange-200 bg-orange-50/30',
      className,
    )}>
      <CardHeader className="pb-3">
        <CardTitle className={cn(
          'text-sm font-semibold flex items-center gap-2',
          isExhausted ? 'text-red-700' : 'text-orange-700',
        )}>
          {isExhausted
            ? <XCircle className="h-4 w-4" />
            : <RefreshCw className="h-4 w-4 animate-spin" />}
          {isExhausted ? 'Failed — Retries Exhausted' : 'Retrying…'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Attempt progress */}
        <div className="flex gap-1.5 items-center flex-wrap">
          {Array.from({ length: maxAttempts }).map((_, i) => {
            const n = i + 1;
            const isDone    = n < attempt;
            const isCurrent = n === attempt;
            return (
              <div
                key={n}
                title={`Attempt ${n}`}
                className={cn(
                  'h-2 flex-1 rounded-full min-w-[16px] max-w-[32px] transition-colors',
                  isDone    ? 'bg-red-400'    :
                  isCurrent ? (isRetrying ? 'bg-orange-400 animate-pulse' : 'bg-red-500') :
                  'bg-muted',
                )}
              />
            );
          })}
          <span className="text-xs text-muted-foreground ml-1 whitespace-nowrap">
            {attempt} / {maxAttempts}
          </span>
        </div>

        {/* Error message */}
        {currentStep.errorMessage && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-red-700 mb-0.5">Last error</p>
            <p className="text-xs text-red-600 font-mono break-all">{currentStep.errorMessage}</p>
          </div>
        )}

        {/* Retry countdown */}
        {isRetrying && countdown !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Next retry in</span>
            <span className="font-mono text-lg font-bold text-orange-600 tabular-nums">
              {formatCountdown(countdown)}
            </span>
          </div>
        )}

        {/* Exhausted actions */}
        {isExhausted && (
          <div className="flex gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onRetry(stepId)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry Step
              </Button>
            )}
            {onViewError && (
              <Button size="sm" variant="ghost" className="flex-1" onClick={onViewError}>
                <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                View Error
              </Button>
            )}
          </div>
        )}

        {/* BLOCKED state */}
        {currentStep.retryable === false && isFailed && currentStep.errorMessage?.toLowerCase().includes('auth') && (
          <div className="rounded border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Action required
            </p>
            <p className="text-xs text-red-600">
              Instagram authorization may have expired. Automatic retries are disabled.
            </p>
            <Button size="sm" variant="destructive" className="w-full mt-1" asChild>
              <a href="/dashboard/settings">Reconnect Instagram</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
