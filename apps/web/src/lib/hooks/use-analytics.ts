'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AccountMetrics, PostMetrics, Post } from '@evolvr/types';

export type DateRangeOption = '7d' | '30d' | '90d';

interface AnalyticsData {
  accountHistory: AccountMetrics[];
  topPosts: Array<Post & { metrics: PostMetrics }>;
  formatPerformance: Array<{ format: string; avgEngagementRate: number; avgReach: number; count: number }>;
  pillarPerformance: Array<{ pillar: string; avgReach: number; avgEngagementRate: number; count: number }>;
  timeWindowPerformance: Array<{ hour: number; avgEngagementRate: number; count: number }>;
}

const fetcher = (path: string) => apiClient.get<AnalyticsData>(path);

export function useAnalytics(range: DateRangeOption = '30d') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/analytics?range=${range}`,
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
