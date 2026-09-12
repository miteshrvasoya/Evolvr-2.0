// agent-progress-steps.tsx — uses a local duck-typed interface
// because the shared AgentStep type uses camelCase DB-derived fields,
// but the status endpoint returns a flattened shape with extra UI fields.
import { Loader2, CheckCircle2, XCircle, Circle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ProgressStep {
  step?: string;
  stepType?: string;
  status: string;
  error?: string | null;
  errorMessage?: string | null;
  logs?: string[];
  timestamp?: string | null;
  startedAt?: string | null;
  attemptNumber?: number;
  maxAttempts?: number;
}

interface AgentProgressStepsProps {
  steps?: ProgressStep[];
}

export function AgentProgressSteps({ steps }: AgentProgressStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4 space-y-3">
      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Process Progress</h4>
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => {
          const label    = step.step ?? step.stepType ?? 'Unknown step';
          const errMsg   = step.error ?? step.errorMessage;
          const ts       = step.timestamp ?? step.startedAt;
          return (
            <div key={idx} className="flex items-start gap-3">
              <div className="mt-0.5">
                {step.status === 'running'   && <Loader2      className="h-4 w-4 animate-spin text-primary" />}
                {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {step.status === 'failed'    && <XCircle      className="h-4 w-4 text-destructive" />}
                {step.status === 'retrying'  && <RefreshCw    className="h-4 w-4 text-orange-400 animate-spin" />}
                {(step.status === 'pending' || step.status === 'queued') && (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    step.status === 'failed'    ? "text-destructive" :
                    step.status === 'running'   ? "text-primary"     :
                    step.status === 'retrying'  ? "text-orange-600"  : "text-foreground"
                  )}>
                    {label.replace(/_/g, ' ')}
                  </span>
                  {step.attemptNumber != null && step.maxAttempts != null && step.attemptNumber > 1 && (
                    <span className="text-[10px] text-orange-600 font-semibold">
                      {step.attemptNumber}/{step.maxAttempts}
                    </span>
                  )}
                </div>
                {errMsg && (
                  <span className="text-xs text-destructive mt-1 bg-destructive/10 px-2 py-1 rounded font-mono">
                    {errMsg}
                  </span>
                )}
                {step.logs && step.logs.length > 0 && (
                  <div className="mt-2 bg-black text-green-400 font-mono text-[10px] sm:text-xs rounded p-2 max-h-40 overflow-y-auto w-full">
                    {step.logs.map((log, i) => (
                      <div key={i} className="break-words mb-1 last:mb-0">{log}</div>
                    ))}
                  </div>
                )}
                {ts && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(ts), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
