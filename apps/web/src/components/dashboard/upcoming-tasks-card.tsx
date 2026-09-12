'use client';

import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatDateTime } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
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

interface UpcomingTasksCardProps {
  tasks: NextActionInfo[];
  className?: string;
}

export function UpcomingTasksCard({ tasks, className }: UpcomingTasksCardProps) {
  if (!tasks.length) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar className="h-7 w-7 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No upcoming tasks scheduled</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Upcoming Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul>
          {tasks.map((task, i) => {
            const date = parseISO(task.scheduledFor);
            const isRunning = task.status === 'running';
            return (
              <li
                key={`${task.jobType}-${i}`}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 border-b last:border-0',
                  isRunning && 'bg-blue-50/50',
                )}
              >
                <div className="flex-shrink-0">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    isRunning ? 'bg-blue-500' : 'bg-muted-foreground/30',
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-medium truncate',
                    isRunning ? 'text-blue-700' : 'text-foreground',
                  )}>
                    {humanizeJob(task.jobType)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDateTime(task.scheduledFor)}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(date, { addSuffix: true })}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
