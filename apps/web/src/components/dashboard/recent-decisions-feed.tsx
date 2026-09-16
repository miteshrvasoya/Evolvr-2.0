'use client';

import {
  CalendarPlus,
  Zap,
  Brain,
  Lightbulb,
  Bot,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RecentWin } from '@/lib/hooks/use-dashboard';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface RecentDecisionsFeedProps {
  decisions: RecentWin[];
}

const decisionConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  SCHEDULE_POST: {
    icon: CalendarPlus,
    label: 'Post Scheduled',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
  },
  PUBLISH_POST: {
    icon: Zap,
    label: 'Post Published',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  GENERATE_CONTENT_PLAN: {
    icon: Brain,
    label: 'Content Plan',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
  },
  RECORD_INSIGHT: {
    icon: Lightbulb,
    label: 'Insight Recorded',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
};

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
      pct >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' :
      pct >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
                  'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    )}>
      {pct}% conf.
    </span>
  );
}

export function RecentDecisionsFeed({ decisions }: RecentDecisionsFeedProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10">
            <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          Recent Agent Activity
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link href="/dashboard/agent">
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Bot className="h-5 w-5 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Agent decisions will appear here when it runs.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {decisions.map((win, idx) => {
              const cfg = decisionConfig[win.decisionType] ?? {
                icon: Bot,
                label: win.decisionType.replace(/_/g, ' '),
                color: 'text-muted-foreground',
                bg: 'bg-muted/40',
              };
              const Icon = cfg.icon;

              return (
                <div
                  key={win.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/40',
                    idx < decisions.length - 1 && 'border-b border-border/50',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
                    cfg.bg,
                  )}>
                    <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                      <ConfidencePill value={win.confidence} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {win.reasoning}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {formatDateTime(win.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
