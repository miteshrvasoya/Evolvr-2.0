'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { StrategyVersion, StrategicInsight, Experiment } from '@evolvr/types';

interface StrategyData {
  active: StrategyVersion | null;
  history: StrategyVersion[];
  insights: StrategicInsight[];
  experiments: Experiment[];
}

const fetcher = (path: string) => apiClient.get<StrategyData>(path);

export function useStrategy() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/strategy',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
