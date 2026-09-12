'use client';

import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatDateTime } from '@/lib/utils';
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns';
import type { NextActionInfo } from '@/lib/hooks/use-agent-status';

const JOB_LABELS: Record<string, string> = {
  daily_cycle:       'Daily agent cycle',
  weekly_strategy:   'Weekly strategy review',
  monthly_review:    'Monthly performance review',
  collect_analytics: 'Collect analytics',
  publish_post:      'Publish post',
  run_research:      'Research run',
  generate_content:  'Generate content',
};

function humanizeJob(jobType: string) {
  return JOB_LABELS[jobType] ?? jobType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface NextActionCardProps {
  nextAction: NextActionInfo | null;
  className?: string;
}

export function NextActionCard({ nextAction, className }: NextActionCardProps) {
  if (!nextAction) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No upcoming action</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            The agent will schedule the next action after completing the current cycle.
          </p>
        </CardContent>
      </Card>
    );
  }

  const scheduledDate = parseISO(nextAction.scheduledFor);
  const isFuture = isAfter(scheduledDate, new Date());

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
          <ArrowRight className="h-4 w-4" />
          Next Action
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-semibold text-foreground">{humanizeJob(nextAction.jobType)}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {isFuture
              ? formatDistanceToNow(scheduledDate, { addSuffix: true })
              : 'Starting soon'}
            {' · '}
            {formatDateTime(nextAction.scheduledFor)}
          </span>
        </div>
        <div className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border',
          nextAction.status === 'running'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        )}>
          {nextAction.status === 'running' ? 'In Progress' : 'Scheduled'}
        </div>
      </CardContent>
    </Card>
  );
}
