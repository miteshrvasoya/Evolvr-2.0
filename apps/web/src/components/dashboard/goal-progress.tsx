'use client';

import { CalendarDays, Target, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminGoal, AccountMetrics } from '@evolvr/types';
import { daysUntil, formatDate, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface GoalProgressProps {
  goal: AdminGoal;
  metrics: AccountMetrics;
}

const metricLabels: Record<string, string> = {
  followers: 'Followers',
  reach: 'Weekly Reach',
  engagement_rate: 'Engagement Rate',
  profile_visits: 'Profile Visits',
  website_clicks: 'Website Clicks',
  shares: 'Shares',
  saves: 'Saves',
};

export function GoalProgress({ goal, metrics }: GoalProgressProps) {
  const currentValue =
    goal.primaryMetric === 'followers'
      ? metrics.followers
      : goal.primaryMetric === 'reach'
      ? metrics.reach
      : goal.primaryMetric === 'profile_visits'
      ? metrics.profileVisits
      : goal.primaryMetric === 'website_clicks'
      ? metrics.websiteClicks
      : 0;

  const progress = Math.min((currentValue / goal.target) * 100, 100);
  const days = daysUntil(goal.deadline);
  const isNearDeadline = days <= 7 && days > 0;
  const isPastDeadline = days <= 0;

  // SVG ring settings
  const size = 88;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Target className="h-3.5 w-3.5 text-primary" />
          </div>
          Active Goal
        </CardTitle>
        <p className="text-xs text-muted-foreground capitalize leading-relaxed">
          {goal.goalType.replace(/_/g, ' ').toLowerCase()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ring progress */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              {/* Background track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={strokeWidth}
              />
              {/* Progress arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-foreground">{progress.toFixed(0)}%</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{metricLabels[goal.primaryMetric] ?? goal.primaryMetric}</p>
            <p className="mt-0.5 text-base font-bold text-foreground">{formatNumber(currentValue)}</p>
            <p className="text-xs text-muted-foreground">of {formatNumber(goal.target)} goal</p>
          </div>
        </div>

        {/* Deadline */}
        <div className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs',
          isPastDeadline
            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
            : isNearDeadline
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            : 'bg-muted/50 text-muted-foreground',
        )}>
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {isPastDeadline
              ? 'Deadline passed'
              : `${days} day${days === 1 ? '' : 's'} left`}
          </span>
          <span className="mx-1 opacity-50">·</span>
          <span>{formatDate(goal.deadline)}</span>
        </div>

        {/* Business outcome snippet */}
        {goal.businessOutcome && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
            <p className="line-clamp-2 leading-relaxed">{goal.businessOutcome}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
