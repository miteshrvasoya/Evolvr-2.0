'use client';

import { CheckCircle2, Cpu, Activity, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentRunSummary } from '@/lib/hooks/use-dashboard';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AgentStateBadge } from './agent-state-badge';

interface AgentSummaryWidgetProps {
  summary: AgentRunSummary;
  agentState: string;
}

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  className?: string;
}

function StatItem({ label, value, icon: Icon, className }: StatItemProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-bold text-foreground leading-none">{value}</span>
    </div>
  );
}

export function AgentSummaryWidget({ summary, agentState }: AgentSummaryWidgetProps) {
  const successRateColor =
    summary.successRate >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : summary.successRate >= 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
              <Cpu className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            Agent Health
          </CardTitle>
          <AgentStateBadge state={agentState} size="sm" />
        </div>
        <p className="text-[11px] text-muted-foreground">30-day run statistics</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            label="Total Runs"
            value={summary.total}
            icon={Activity}
          />
          <StatItem
            label="Completed"
            value={summary.completed}
            icon={CheckCircle2}
          />
        </div>

        {/* Success rate bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">Success Rate</span>
            <span className={cn('text-sm font-bold', successRateColor)}>
              {summary.total > 0 ? `${summary.successRate}%` : '—'}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                summary.successRate >= 80
                  ? 'bg-emerald-500'
                  : summary.successRate >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500',
              )}
              style={{ width: `${summary.successRate}%` }}
            />
          </div>
        </div>

        {/* Last run */}
        {summary.lastRunAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>Last run: <span className="text-foreground font-medium">{formatDateTime(summary.lastRunAt)}</span></span>
          </div>
        )}

        {summary.total === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No runs in the last 30 days</p>
        )}
      </CardContent>
    </Card>
  );
}
