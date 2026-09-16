'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Radio,
  TrendingUp,
  Heart,
  Bot,
  RefreshCw,
  ArrowRight,
  FileText,
  Sparkles,
  Target,
} from 'lucide-react';
import { useDashboard } from '@/lib/hooks/use-dashboard';
import { useAgentStatus } from '@/lib/hooks/use-agent-status';
import { MetricCard } from '@/components/dashboard/metric-card';
import { GoalProgress } from '@/components/dashboard/goal-progress';
import { FollowerAreaChart } from '@/components/dashboard/follower-area-chart';
import { AgentStateBadge } from '@/components/dashboard/agent-state-badge';
import { AgentSummaryWidget } from '@/components/dashboard/agent-summary-widget';
import { UpcomingPostsList } from '@/components/dashboard/upcoming-posts-list';
import { RecentDecisionsFeed } from '@/components/dashboard/recent-decisions-feed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

// ── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, syncAnalytics } = useDashboard();
  const { status: agentStatus } = useAgentStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const {
    accountId,
    accountMetrics,
    trends,
    engagementRate,
    publishedLast7Days,
    goal,
    upcomingPosts,
    metricsHistory,
    agentRunSummary,
    recentWins,
  } = data;

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleSync = async () => {
    if (!accountId) return;
    setIsSyncing(true);
    const success = await syncAnalytics(accountId);
    setIsSyncing(false);

    if (success) {
      toast({
        title: 'Sync Complete',
        description: 'Successfully updated Instagram metrics.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Could not fetch data from Instagram.',
      });
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{today}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{greeting} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&apos;s what&apos;s happening with your social growth today.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {agentStatus && (
            <Button variant="outline" size="sm" asChild className="gap-2 text-xs">
              <Link href="/dashboard/agent">
                <AgentStateBadge state={agentStatus.state} size="sm" />
                View Agent
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || !accountId}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing…' : 'Sync Data'}
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Followers"
          value={accountMetrics.followers ?? 0}
          icon={Users}
          trend={trends?.followers}
          format="number"
          gradientFrom="from-blue-500"
          gradientTo="to-blue-600"
        />
        <MetricCard
          label="Weekly Reach"
          value={accountMetrics.reach ?? 0}
          icon={Radio}
          trend={trends?.reach}
          format="number"
          gradientFrom="from-violet-500"
          gradientTo="to-violet-600"
        />
        <MetricCard
          label="Engagement Rate"
          value={engagementRate ?? 0}
          icon={Heart}
          trend={trends?.impressions}
          format="percent"
          gradientFrom="from-pink-500"
          gradientTo="to-rose-500"
          description="30-day avg on published posts"
        />
        <MetricCard
          label="Posts This Week"
          value={publishedLast7Days ?? upcomingPosts.length}
          icon={FileText}
          format="number"
          gradientFrom="from-emerald-500"
          gradientTo="to-teal-500"
          description={`${upcomingPosts.length} scheduled upcoming`}
        />
      </div>

      {/* ── Chart + Goal ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Area Chart — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Follower & Reach Growth</CardTitle>
                <CardDescription className="text-xs mt-0.5">Last 7 data points</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/dashboard/analytics">
                  Full Analytics <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {metricsHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">No historical data yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Sync your Instagram account to start tracking.
                </p>
              </div>
            ) : (
              <FollowerAreaChart data={metricsHistory} />
            )}
          </CardContent>
        </Card>

        {/* Goal Progress — 1/3 width */}
        {goal ? (
          <GoalProgress goal={goal} metrics={accountMetrics} />
        ) : (
          <Card className="flex flex-col items-center justify-center text-center p-6 border-dashed">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Target className="h-5 w-5 text-muted-foreground opacity-50" />
            </div>
            <CardTitle className="text-sm font-semibold">No Active Goal</CardTitle>
            <CardDescription className="mt-2 text-xs leading-relaxed">
              Set a growth goal in Settings to let the agent guide your strategy.
            </CardDescription>
            <Button variant="outline" size="sm" className="mt-4 text-xs" asChild>
              <Link href="/dashboard/settings">Set a Goal</Link>
            </Button>
          </Card>
        )}
      </div>

      {/* ── Bottom Three-Column Section ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Upcoming Posts */}
        <UpcomingPostsList posts={upcomingPosts} />

        {/* Recent Agent Decisions */}
        <RecentDecisionsFeed decisions={recentWins ?? []} />

        {/* Agent Health */}
        <AgentSummaryWidget
          summary={agentRunSummary ?? { total: 0, completed: 0, successRate: 0, lastRunAt: null }}
          agentState={agentStatus?.state ?? 'IDLE'}
        />
      </div>
    </div>
  );
}
