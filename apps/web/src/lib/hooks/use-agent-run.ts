'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AgentRun, AgentStep, AgentEvent } from '@evolvr/types';

export interface AgentRunDetail {
  run: AgentRun;
  steps: AgentStep[];
  events: AgentEvent[];
}

const fetcher = async (runId: string): Promise<AgentRunDetail> => {
  const [run, stepsData, eventsData] = await Promise.all([
    apiClient.get<{ run: AgentRun }>(`/api/agent/runs/${runId}`).then(d => d.run),
    apiClient.get<{ steps: AgentStep[] }>(`/api/agent/runs/${runId}/steps`).then(d => d.steps),
    apiClient.get<{ events: AgentEvent[] }>(`/api/agent/runs/${runId}/events`).then(d => d.events),
  ]);
  return { run, steps: stepsData, events: eventsData };
};

export function useAgentRun(runId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    runId ? runId : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: (data) => {
        const status = data?.run?.status;
        if (!status) return 5000;
        return ['running', 'queued', 'retrying'].includes(status) ? 3000 : 30000;
      },
    }
  );

  return { runDetail: data, error, isLoading, refresh: mutate };
}
