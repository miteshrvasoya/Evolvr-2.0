'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AgentState, AgentRun, AgentDecision, ScheduledJob } from '@evolvr/types';

interface AgentStatus {
  state: AgentState;
  currentRun: AgentRun | null;
  recentDecisions: AgentDecision[];
  scheduledJobs: ScheduledJob[];
  recentErrors: Array<{ message: string; timestamp: string }>;
  recentApiLogs?: Array<{
    method: string;
    url: string;
    statusCode: number;
    latencyMs: number;
    createdAt: string;
  }>;
  lastUpdated: string;
}

const fetcher = (path: string) => apiClient.get<AgentStatus>(path);

export function useAgentStatus() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/agent/status',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  async function triggerDailyCycle() {
    await apiClient.post('/api/agent/trigger', { cycleType: 'daily' });
    await mutate();
  }

  return {
    status: data,
    error,
    isLoading,
    triggerDailyCycle,
    refresh: mutate,
  };
}
