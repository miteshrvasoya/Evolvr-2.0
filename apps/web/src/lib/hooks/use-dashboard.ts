'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AccountMetrics, AdminGoal, Post } from '@evolvr/types';

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
  accountMetrics: AccountMetrics;
  trends: MetricTrends;
  engagementRate: number;
  publishedLast7Days: number;
  goal: AdminGoal | null;
  upcomingPosts: Post[];
  metricsHistory: AccountMetrics[];
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
