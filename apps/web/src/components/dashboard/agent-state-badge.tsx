import type { AgentState } from '@evolvr/types';
import { Badge } from '@/components/ui/badge';

const stateConfig: Record<AgentState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  IDLE: { label: 'Idle', variant: 'secondary' },
  OBSERVING: { label: 'Observing', variant: 'info' },
  RESEARCHING: { label: 'Researching', variant: 'info' },
  PLANNING: { label: 'Planning', variant: 'info' },
  CREATING: { label: 'Creating', variant: 'info' },
  VALIDATING: { label: 'Validating', variant: 'warning' },
  SCHEDULED: { label: 'Scheduled', variant: 'success' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  MEASURING: { label: 'Measuring', variant: 'info' },
  LEARNING: { label: 'Learning', variant: 'info' },
  REPLANNING: { label: 'Replanning', variant: 'warning' },
  AUTH_REQUIRED: { label: 'Auth Required', variant: 'destructive' },
  WAITING_APPROVAL: { label: 'Waiting Approval', variant: 'warning' },
  RETRYING: { label: 'Retrying', variant: 'warning' },
  BLOCKED: { label: 'Blocked', variant: 'destructive' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};

interface AgentStateBadgeProps {
  state: AgentState;
  className?: string;
}

export function AgentStateBadge({ state, className }: AgentStateBadgeProps) {
  const config = stateConfig[state] ?? { label: state, variant: 'secondary' as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export { stateConfig };
