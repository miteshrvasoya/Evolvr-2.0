import { CalendarDays, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminGoal, AccountMetrics } from '@evolvr/types';
import { daysUntil, formatDate, formatNumber } from '@/lib/utils';

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Goal Progress
        </CardTitle>
        <p className="text-sm text-muted-foreground capitalize">
          {goal.goalType.replace(/_/g, ' ').toLowerCase()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">{metricLabels[goal.primaryMetric] ?? goal.primaryMetric}</span>
            <span className="font-medium">
              {formatNumber(currentValue)} / {formatNumber(goal.target)}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="mt-1 text-right text-xs text-muted-foreground">{progress.toFixed(1)}%</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>
            {days > 0 ? `${days} days remaining` : 'Deadline passed'} · Deadline{' '}
            {formatDate(goal.deadline)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
