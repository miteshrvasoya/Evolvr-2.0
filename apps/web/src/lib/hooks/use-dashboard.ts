'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AccountMetrics, AdminGoal, Post } from '@evolvr/types';

interface DashboardOverview {
  accountId?: string;
  accountMetrics: AccountMetrics;
  goal: AdminGoal | null;
  upcomingPosts: Post[];
  metricsHistory: AccountMetrics[];
}

const fetcher = (path: string) => apiClient.get<DashboardOverview>(path);

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/dashboard/overview',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

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
