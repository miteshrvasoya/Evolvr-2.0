import type { AgentDecision } from '@evolvr/types';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DecisionLogEntryProps {
  decision: AgentDecision;
}

const decisionTypeColors: Record<string, string> = {
  GENERATE_CONTENT_PLAN: 'info',
  REVISE_STRATEGY: 'warning',
  RUN_RESEARCH: 'info',
  SCHEDULE_POST: 'success',
  PUBLISH_POST: 'success',
  CREATE_EXPERIMENT: 'info',
  RECORD_INSIGHT: 'secondary',
  SEND_NOTIFICATION: 'secondary',
  BLOCK_AWAITING_APPROVAL: 'warning',
  UPDATE_CONTENT_MIX: 'info',
};

export function DecisionLogEntry({ decision }: DecisionLogEntryProps) {
  const variant = (decisionTypeColors[decision.decisionType] ?? 'secondary') as 'info' | 'warning' | 'success' | 'secondary';

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={variant} className="text-xs">
            {decision.decisionType.replace(/_/g, ' ')}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDateTime(decision.createdAt)}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{decision.reasoning}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Confidence: {(decision.confidence * 100).toFixed(0)}%</span>
          <span>Evidence: {decision.evidence.length}</span>
        </div>
      </div>
    </div>
  );
}
