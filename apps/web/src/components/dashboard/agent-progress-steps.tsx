import { AgentStep } from '@evolvr/types';
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AgentProgressStepsProps {
  steps?: AgentStep[];
}

export function AgentProgressSteps({ steps }: AgentProgressStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4 space-y-3">
      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Process Progress</h4>
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="mt-0.5">
              {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {step.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
              {step.status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-sm font-medium",
                step.status === 'failed' ? "text-destructive" :
                step.status === 'running' ? "text-primary" : "text-foreground"
              )}>
                {step.step}
              </span>
              {step.error && (
                <span className="text-xs text-destructive mt-1 bg-destructive/10 px-2 py-1 rounded">
                  {step.error}
                </span>
              )}
              {step.timestamp && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(step.timestamp), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
