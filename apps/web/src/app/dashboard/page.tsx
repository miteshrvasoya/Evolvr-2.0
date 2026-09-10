'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Radio, TrendingUp, FileText, Bot, RefreshCw, ArrowRight } from 'lucide-react';
import { useDashboard } from '@/lib/hooks/use-dashboard';
import { useAgentStatus } from '@/lib/hooks/use-agent-status';
import { MetricCard } from '@/components/dashboard/metric-card';
import { GoalProgress } from '@/components/dashboard/goal-progress';
import { GrowthChart } from '@/components/dashboard/growth-chart';
import { AgentStateBadge } from '@/components/dashboard/agent-state-badge';
import { PostStatusBadge } from '@/components/dashboard/post-status-badge';
import { DecisionLogEntry } from '@/components/dashboard/decision-log-entry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
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
  const { data, isLoading, syncAnalytics } = useDashboard();
  const { status: agentStatus } = useAgentStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const { accountId, accountMetrics, goal, upcomingPosts, metricsHistory } = data;

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
    <div className="space-y-8 animate-in fade-in duration-500 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your social media performance and AI agent activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync} 
            disabled={isSyncing || !accountId}
            className="shadow-sm bg-white/50 dark:bg-black/50 backdrop-blur-sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Agent Status */}
        <div className="lg:col-span-4">
          {agentStatus && (
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 w-1 bg-primary"></div>
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">Evolvr Agent</h3>
                      <AgentStateBadge state={agentStatus.state} />
                    </div>
                    {agentStatus.currentRun ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Currently focusing on: <span className="font-medium text-foreground">{agentStatus.currentRun.runType.replace(/_/g, ' ')}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Waiting for next scheduled task.
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="shrink-0 group">
                  <Link href="/dashboard/agent">
                    View Details
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Key Metrics */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="lg:col-span-1 flex flex-col gap-6">
          {goal ? (
            <GoalProgress goal={goal} metrics={accountMetrics} />
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-6 border-dashed">
              <Bot className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <CardTitle className="text-sm">No Active Goal</CardTitle>
              <CardDescription className="mt-2 text-xs">
                Set an overarching goal in settings to let the agent guide your growth.
              </CardDescription>
            </Card>
          )}
        </div>
        
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Follower Growth (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart data={metricsHistory} />
          </CardContent>
        </Card>

        {/* Upcoming Posts + Latest Decision */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Upcoming Posts</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/dashboard/content"><ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mb-3 opacity-20" />
                <p className="text-sm text-muted-foreground">No posts scheduled yet</p>
              </div>
            ) : (
              <ul className="space-y-4 mt-2">
                {upcomingPosts.slice(0, 3).map((post) => (
                  <li key={post.id} className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-2 leading-relaxed">{post.caption}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground font-medium bg-background px-2 py-0.5 rounded-full border">
                          {post.mediaType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(post.scheduledAt)}
                        </span>
                      </div>
                    </div>
                    <PostStatusBadge status={post.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Recent Agent Activity</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/dashboard/agent"><ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {agentStatus?.recentDecisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="h-8 w-8 text-muted-foreground mb-3 opacity-20" />
                <p className="text-sm text-muted-foreground">No recent activity logged</p>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
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
