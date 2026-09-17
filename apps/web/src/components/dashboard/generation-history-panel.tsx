'use client';

import { useState } from 'react';
import type { GenerationAttempt } from '@/lib/hooks/use-content-detail';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface GenerationHistoryPanelProps {
  attempts: GenerationAttempt[];
}

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  timeout:        'Timeout',
  rate_limited:   'Rate Limited',
  provider_error: 'Provider Error',
  auth_error:     'Authentication',
  content_policy: 'Content Policy',
  invalid_prompt: 'Invalid Prompt',
  quota_exceeded: 'Quota Exceeded',
  transient:      'Transient Error',
  permanent:      'Permanent Error',
};

function AttemptRow({ attempt }: { attempt: GenerationAttempt }) {
  const [open, setOpen] = useState(false);

  const isSuccess = attempt.status === 'generated';
  const isFailed = attempt.status === 'failed';
  const isRunning = ['pending', 'generating'].includes(attempt.status);

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      isSuccess && 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/10',
      isFailed && 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10',
      isRunning && 'border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/10',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
        {isFailed && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
        {isRunning && <Loader2 className="h-4 w-4 text-amber-500 shrink-0 animate-spin" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">Attempt #{attempt.attemptNumber}</span>
            <Badge
              variant={isSuccess ? 'success' : isFailed ? 'destructive' : 'secondary'}
              className="text-[10px] capitalize"
            >
              {attempt.status}
            </Badge>
            <span className="text-xs text-muted-foreground capitalize">
              {attempt.assetType?.replace('_', ' ')}
            </span>
            {attempt.provider && (
              <span className="text-xs text-muted-foreground">{attempt.provider}</span>
            )}
            {attempt.durationMs && (
              <span className="text-xs text-muted-foreground">{(attempt.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>

          {isFailed && attempt.errorCategory && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {ERROR_CATEGORY_LABELS[attempt.errorCategory] || attempt.errorCategory}
              {attempt.errorMessage ? ` — ${attempt.errorMessage.slice(0, 80)}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(attempt.createdAt), { addSuffix: true })}
          </span>
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
            {attempt.startedAt && (
              <>
                <span className="text-muted-foreground">Started</span>
                <span>{format(new Date(attempt.startedAt), 'HH:mm:ss, MMM d')}</span>
              </>
            )}
            {attempt.completedAt && (
              <>
                <span className="text-muted-foreground">Completed</span>
                <span>{format(new Date(attempt.completedAt), 'HH:mm:ss, MMM d')}</span>
              </>
            )}
            {attempt.durationMs && (
              <>
                <span className="text-muted-foreground">Duration</span>
                <span>{attempt.durationMs}ms</span>
              </>
            )}
            {attempt.provider && (
              <>
                <span className="text-muted-foreground">Provider</span>
                <span className="capitalize">{attempt.provider}</span>
              </>
            )}
            {attempt.promptVersion && (
              <>
                <span className="text-muted-foreground">Prompt</span>
                <span>v{attempt.promptVersion} ({attempt.promptSource?.replace('_', ' ')})</span>
              </>
            )}
            {attempt.idempotencyKey && (
              <>
                <span className="text-muted-foreground">Job Key</span>
                <span className="font-mono truncate">{attempt.idempotencyKey}</span>
              </>
            )}
          </div>

          {attempt.promptText && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Prompt used:</p>
              <div className="rounded bg-muted/40 border p-2 text-xs font-mono leading-relaxed line-clamp-3">
                {attempt.promptText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GenerationHistoryPanel({ attempts }: GenerationHistoryPanelProps) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <Clock className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No generation attempts yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Every generation attempt will be recorded here, including retries and their outcomes.
        </p>
      </div>
    );
  }

  const successful = attempts.filter(a => a.status === 'generated').length;
  const failed = attempts.filter(a => a.status === 'failed').length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</span>
        {successful > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            {successful} succeeded
          </span>
        )}
        {failed > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="h-3 w-3" />
            {failed} failed
          </span>
        )}
      </div>

      {attempts.map(attempt => (
        <AttemptRow key={attempt.id} attempt={attempt} />
      ))}
    </div>
  );
}
