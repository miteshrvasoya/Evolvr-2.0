'use client';

import { Users, Radio, TrendingUp, FileText, Bot } from 'lucide-react';
import { useDashboard } from '@/lib/hooks/use-dashboard';
import { useAgentStatus } from '@/lib/hooks/use-agent-status';
import { MetricCard } from '@/components/dashboard/metric-card';
import { GoalProgress } from '@/components/dashboard/goal-progress';
import { GrowthChart } from '@/components/dashboard/growth-chart';
import { AgentStateBadge } from '@/components/dashboard/agent-state-badge';
import { PostStatusBadge } from '@/components/dashboard/post-status-badge';
import { DecisionLogEntry } from '@/components/dashboard/decision-log-entry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="col-span-2 h-48" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { status: agentStatus } = useAgentStatus();

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const { accountMetrics, goal, upcomingPosts, metricsHistory } = data;

  return (
    <div className="space-y-6">
      {/* Agent Status Banner */}
      {agentStatus && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Bot className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Agent Status:</span>
          <AgentStateBadge state={agentStatus.state} />
          {agentStatus.currentRun && (
            <span className="text-sm text-muted-foreground ml-2">
              Running: {agentStatus.currentRun.runType.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Followers"
          value={accountMetrics.followers}
          icon={Users}
          format="number"
        />
        <MetricCard
          label="Weekly Reach"
          value={accountMetrics.reach}
          icon={Radio}
          format="number"
        />
        <MetricCard
          label="Profile Visits"
          value={accountMetrics.profileVisits}
          icon={TrendingUp}
          format="number"
        />
        <MetricCard
          label="Posts Scheduled"
          value={upcomingPosts.length}
          icon={FileText}
          format="number"
        />
      </div>

      {/* Goal + Growth Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {goal && <GoalProgress goal={goal} metrics={accountMetrics} />}
        <Card className={goal ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle className="text-base">Follower Growth (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart data={metricsHistory} />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Posts + Latest Decision */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled posts</p>
            ) : (
              <ul className="space-y-3">
                {upcomingPosts.slice(0, 3).map((post) => (
                  <li key={post.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm line-clamp-2">{post.caption}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(post.scheduledAt)} · {post.mediaType}
                      </p>
                    </div>
                    <PostStatusBadge status={post.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Agent Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {agentStatus?.recentDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent decisions</p>
            ) : (
              <div>
                {agentStatus?.recentDecisions.slice(0, 3).map((d) => (
                  <DecisionLogEntry key={d.id} decision={d} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
