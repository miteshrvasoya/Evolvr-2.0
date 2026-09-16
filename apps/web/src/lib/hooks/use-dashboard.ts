'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AdminGoal, Post } from '@evolvr/types';

// Extended AccountMetrics that includes the new insight columns
export interface InsightMetrics {
  views: number;
  accountsEngaged: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  replies: number;
  reposts: number;
  totalInteractions: number;
  profileLinksTaps: number;
  follows: number;
  unfollows: number;
}

// Full account metrics shape from DB (camelCase from postgres.js)
export interface AccountMetricsRow {
  id: string;
  socialAccountId: string;
  capturedAt: string;
  followers: number;
  following: number;
  reach: number;
  impressions: number;
  profileVisits: number;
  interactions: number;
  websiteClicks: number;
  // new insight columns
  views: number;
  accountsEngaged: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  replies: number;
  reposts: number;
  totalInteractions: number;
  profileLinksTaps: number;
  follows: number;
  unfollows: number;
  rawMetrics: Record<string, unknown>;
  // allow index access for dynamic lookups
  [key: string]: unknown;
}

export interface MetricTrends {
  followers: number;
  reach: number;
  profileVisits: number;
  impressions: number;
}

export interface AgentRunSummary {
  total: number;
  completed: number;
  successRate: number;
  lastRunAt: string | null;
}

export interface RecentWin {
  id: string;
  decisionType: string;
  reasoning: string;
  confidence: number;
  createdAt: string;
}

export interface DashboardOverview {
  accountId?: string;
  accountMetrics: AccountMetricsRow;
  trends: MetricTrends;
  engagementRate: number;
  publishedLast7Days: number;
  goal: AdminGoal | null;
  upcomingPosts: Post[];
  metricsHistory: AccountMetricsRow[];
  agentRunSummary: AgentRunSummary;
  recentWins: RecentWin[];
}

const fetcher = (path: string) => apiClient.get<DashboardOverview>(path);

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/dashboard/overview',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const syncAnalytics = async (accountId: string) => {
    try {
      await apiClient.post(`/api/accounts/${accountId}/analytics/sync`);
      await mutate();
      return true;
    } catch (e) {
      console.error('Failed to sync analytics', e);
      return false;
    }
  };

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
    syncAnalytics,
  };
}
