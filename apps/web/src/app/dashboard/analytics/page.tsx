'use client';

import { useState } from 'react';
import { useAnalytics } from '@/lib/hooks/use-analytics';
import type { DateRangeOption } from '@/lib/hooks/use-analytics';
import { GrowthChart } from '@/components/dashboard/growth-chart';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatNumber, formatPercent } from '@/lib/utils';
import { TrendingUp, Eye, Heart, Users } from 'lucide-react';

const RANGE_OPTIONS: { label: string; value: DateRangeOption }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeOption>('30d');
  const { data, isLoading } = useAnalytics(range);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { accountHistory, topPosts, formatPerformance, pillarPerformance } = data;

  // Compute derived KPIs from topPosts
  const avgEngagement = topPosts.length > 0
    ? topPosts.reduce((sum, p) => sum + (p.metrics.engagementRate ?? 0), 0) / topPosts.length
    : 0;
  const avgSaveRate = topPosts.length > 0
    ? topPosts.reduce((sum, p) => sum + (p.metrics.saveRate ?? 0), 0) / topPosts.length
    : 0;
  const avgProfileVisitRate = topPosts.length > 0
    ? topPosts.reduce((sum, p) => sum + (p.metrics.profileVisitRate ?? 0), 0) / topPosts.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              range === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-accent',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Avg Engagement Rate"
          value={avgEngagement}
          icon={Heart}
          format="percent"
        />
        <MetricCard
          label="Avg Save Rate"
          value={avgSaveRate}
          icon={TrendingUp}
          format="percent"
        />
        <MetricCard
          label="Avg Profile Visit Rate"
          value={avgProfileVisitRate}
          icon={Users}
          format="percent"
        />
        <MetricCard
          label="Posts Analyzed"
          value={topPosts.length}
          icon={Eye}
          format="number"
        />
      </div>

      {/* Follower Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follower Growth ({range})</CardTitle>
        </CardHeader>
        <CardContent>
          <GrowthChart data={accountHistory} />
        </CardContent>
      </Card>

      {/* Format & Pillar Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement by Format</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceChart
              data={formatPerformance.map((f) => ({ ...f, name: f.format }))}
              metric="engagementRate"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reach by Pillar</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceChart
              data={pillarPerformance.map((p) => ({ ...p, name: p.pillar }))}
              metric="reach"
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Performing Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No analytics data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Caption</th>
                    <th className="pb-2 text-left font-medium">Format</th>
                    <th className="pb-2 text-right font-medium">Reach</th>
                    <th className="pb-2 text-right font-medium">Likes</th>
                    <th className="pb-2 text-right font-medium">Saves</th>
                    <th className="pb-2 text-right font-medium">Eng. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map((post) => (
                    <tr key={post.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 max-w-xs">
                        <p className="line-clamp-1">{post.caption}</p>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="capitalize">{post.mediaType}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">{formatNumber(post.metrics.reach)}</td>
                      <td className="py-2 pr-4 text-right">{formatNumber(post.metrics.likes)}</td>
                      <td className="py-2 pr-4 text-right">{formatNumber(post.metrics.saves)}</td>
                      <td className="py-2 text-right font-medium text-emerald-600">
                        {post.metrics.engagementRate != null
                          ? formatPercent(post.metrics.engagementRate)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
