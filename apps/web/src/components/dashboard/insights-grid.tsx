'use client';

import {
  Eye, Heart, MessageCircle, Share2, Bookmark,
  MessageSquare, Repeat2, Users, Zap, MousePointerClick,
  UserPlus, UserMinus, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';
import type { AccountMetricsRow } from '@/lib/hooks/use-dashboard';

interface InsightsGridProps {
  metrics: AccountMetricsRow;
}

interface InsightItemProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  note?: string;
}

function InsightItem({ label, value, icon: Icon, iconBg, iconColor, note }: InsightItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground leading-tight">{label}</p>
        <p className="text-base font-bold text-foreground leading-tight mt-0.5">{formatNumber(value)}</p>
        {note && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

export function InsightsGrid({ metrics }: InsightsGridProps) {
  const netFollows = (metrics.follows ?? 0) - (metrics.unfollows ?? 0);
  const isNetPositive = netFollows >= 0;

  const items: InsightItemProps[] = [
    {
      label: 'Views',
      value: metrics.views ?? 0,
      icon: Eye,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      note: 'Times content was played/displayed',
    },
    {
      label: 'Accounts Engaged',
      value: metrics.accountsEngaged ?? 0,
      icon: Users,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      note: 'Unique accounts who interacted',
    },
    {
      label: 'Likes',
      value: metrics.likes ?? 0,
      icon: Heart,
      iconBg: 'bg-rose-500/10',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Comments',
      value: metrics.comments ?? 0,
      icon: MessageCircle,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Shares',
      value: metrics.shares ?? 0,
      icon: Share2,
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      label: 'Saves',
      value: metrics.saves ?? 0,
      icon: Bookmark,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Replies',
      value: metrics.replies ?? 0,
      icon: MessageSquare,
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-600 dark:text-teal-400',
      note: 'Story replies received',
    },
    {
      label: 'Reposts',
      value: metrics.reposts ?? 0,
      icon: Repeat2,
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Total Interactions',
      value: metrics.totalInteractions ?? 0,
      icon: Zap,
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      note: 'Likes + comments + shares + saves + more',
    },
    {
      label: 'Profile Link Taps',
      value: metrics.profileLinksTaps ?? 0,
      icon: MousePointerClick,
      iconBg: 'bg-pink-500/10',
      iconColor: 'text-pink-600 dark:text-pink-400',
      note: 'Call / email / direction taps',
    },
    {
      label: 'New Follows',
      value: metrics.follows ?? 0,
      icon: UserPlus,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Unfollows',
      value: metrics.unfollows ?? 0,
      icon: UserMinus,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500 dark:text-red-400',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              Engagement Breakdown
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">7-day totals from Instagram Insights</CardDescription>
          </div>

          {/* Net follows pill */}
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border',
            isNetPositive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
          )}>
            {isNetPositive ? (
              <UserPlus className="h-3 w-3" />
            ) : (
              <UserMinus className="h-3 w-3" />
            )}
            Net {isNetPositive ? '+' : ''}{formatNumber(netFollows)} followers
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <InsightItem key={item.label} {...item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
