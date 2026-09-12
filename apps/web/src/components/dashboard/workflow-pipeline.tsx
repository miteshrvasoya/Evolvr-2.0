'use client';

import { CheckCircle2, Circle, Loader2, XCircle, RefreshCw, PauseCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PipelineStepStatus = 'completed' | 'running' | 'retrying' | 'pending' | 'failed' | 'blocked' | 'paused' | 'queued';

export interface PipelineStep {
  key: string;
  label: string;
  status: PipelineStepStatus;
  attemptNumber?: number;
  maxAttempts?: number;
  error?: string | null;
}

const KNOWN_PIPELINE: { key: string; label: string }[] = [
  { key: 'evaluate_next_action', label: 'Evaluate' },
  { key: 'run_research',         label: 'Research'  },
  { key: 'revise_strategy',      label: 'Strategy'  },
  { key: 'generate_content',     label: 'Generate'  },
  { key: 'validate_content',     label: 'Validate'  },
  { key: 'schedule_post',        label: 'Schedule'  },
  { key: 'publish_post',         label: 'Publish'   },
  { key: 'collect_analytics',    label: 'Analytics' },
  { key: 'run_learning',         label: 'Learn'     },
];

function StepIcon({ status }: { status: PipelineStepStatus }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'running':   return <Loader2      className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'retrying':  return <RefreshCw    className="h-4 w-4 text-orange-500 animate-spin" />;
    case 'failed':    return <XCircle      className="h-4 w-4 text-red-500" />;
    case 'blocked':   return <AlertCircle  className="h-4 w-4 text-red-400" />;
    case 'paused':    return <PauseCircle  className="h-4 w-4 text-slate-400" />;
    case 'queued':    return <Circle       className="h-4 w-4 text-purple-400" />;
    default:          return <Circle       className="h-4 w-4 text-muted-foreground/30" />;
  }
}

function stepLabel(status: PipelineStepStatus) {
  switch (status) {
    case 'completed': return 'text-emerald-700';
    case 'running':   return 'text-blue-700 font-semibold';
    case 'retrying':  return 'text-orange-700 font-semibold';
    case 'failed':    return 'text-red-700';
    case 'blocked':   return 'text-red-600';
    case 'paused':    return 'text-slate-500';
    default:          return 'text-muted-foreground/50';
  }
}

interface WorkflowPipelineProps {
  /** Raw steps from agent run progress */
  steps: Array<{
    step: string;
    status: string;
    attemptNumber?: number;
    maxAttempts?: number;
    error?: string | null;
  }>;
  className?: string;
  compact?: boolean;
}

export function WorkflowPipeline({ steps, className, compact = false }: WorkflowPipelineProps) {
  // Build pipeline by merging known steps with actual run data
  const stepMap = new Map(steps.map(s => [s.step, s]));

  const pipeline: PipelineStep[] = KNOWN_PIPELINE.map(p => {
    const actual = stepMap.get(p.key);
    return {
      key:   p.key,
      label: p.label,
      status: (actual?.status ?? 'pending') as PipelineStepStatus,
      attemptNumber: actual?.attemptNumber,
      maxAttempts:   actual?.maxAttempts,
      error: actual?.error,
    };
  });

  // Also include any steps from the run that aren't in KNOWN_PIPELINE
  for (const s of steps) {
    if (!pipeline.some(p => p.key === s.step)) {
      pipeline.push({
        key:   s.step,
        label: s.step.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        status: s.status as PipelineStepStatus,
        attemptNumber: s.attemptNumber,
        maxAttempts:   s.maxAttempts,
        error: s.error,
      });
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 flex-wrap', className)}>
        {pipeline.map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex items-center gap-1" title={step.label}>
              <StepIcon status={step.status} />
              <span className={cn('text-[11px]', stepLabel(step.status))}>{step.label}</span>
            </div>
            {i < pipeline.length - 1 && (
              <span className="text-muted-foreground/30 text-xs">→</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {pipeline.map((step, i) => (
        <div key={step.key} className="flex gap-3">
          {/* Timeline track */}
          <div className="flex flex-col items-center">
            <div className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border-2 flex-shrink-0',
              step.status === 'completed' ? 'border-emerald-400 bg-emerald-50' :
              step.status === 'running'   ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200 ring-offset-1' :
              step.status === 'retrying'  ? 'border-orange-400 bg-orange-50' :
              step.status === 'failed'    ? 'border-red-400 bg-red-50' :
              step.status === 'blocked'   ? 'border-red-300 bg-red-50' :
              'border-muted bg-background',
            )}>
              <StepIcon status={step.status} />
            </div>
            {i < pipeline.length - 1 && (
              <div className={cn(
                'w-0.5 flex-1 my-0.5',
                step.status === 'completed' ? 'bg-emerald-200' : 'bg-border',
              )} style={{ minHeight: '20px' }} />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm', stepLabel(step.status))}>
                {step.label}
              </span>
              {step.status === 'retrying' && step.attemptNumber && step.maxAttempts && (
                <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-medium">
                  Attempt {step.attemptNumber}/{step.maxAttempts}
                </span>
              )}
              {step.status === 'running' && (
                <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">
                  In progress
                </span>
              )}
            </div>
            {step.error && (step.status === 'failed' || step.status === 'retrying') && (
              <p className="text-[11px] text-red-500 mt-1 font-mono truncate" title={step.error}>
                {step.error}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
