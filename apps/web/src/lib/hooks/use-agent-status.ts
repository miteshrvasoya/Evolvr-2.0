'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import type { AgentState, AgentRun, AgentDecision, ScheduledJob, AgentStep } from '@evolvr/types';

export interface CurrentStepInfo {
  stepType: string;
  status: string;
  attemptNumber: number;
  maxAttempts: number;
  startedAt: string | null;
  errorMessage: string | null;
  retryable: boolean;
  nextRetryAt: string | null;
  elapsedSeconds: number;
}

export interface NextActionInfo {
  jobType: string;
  scheduledFor: string;
  status: string;
}

export interface AgentStatus {
  /** Semantic state: RUNNING | WAITING | PAUSED | RETRYING | BLOCKED | FAILED | COMPLETED | CANCELLED | IDLE | QUEUED */
  state: string;
  currentRun: (Omit<AgentRun, 'progress'> & {
    progress?: (AgentStep & {
      step: string;
      timestamp: string;
      error: string | null;
      logs: string[];
      attemptNumber?: number;
      maxAttempts?: number;
      nextRetryAt?: string | null;
    })[];
    lastActivityAt?: string | null;
    lastHeartbeatAt?: string | null;
    retryCount?: number;
  }) | null;
  /** Currently executing or most-recently-active step */
  currentStep: CurrentStepInfo | null;
  /** Next pending scheduled job */
  nextAction: NextActionInfo | null;
  /** Next 5 scheduled actions */
  upcomingActions: NextActionInfo[];
  recentDecisions: AgentDecision[];
  scheduledJobs: ScheduledJob[];
  recentErrors: Array<{ message: string; timestamp: string }>;
  recentApiLogs: Array<{
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
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: (data) => {
        const s = data?.state ?? '';
        return ['RUNNING', 'RETRYING', 'QUEUED'].includes(s) ? 3000 : 30000;
      },
    }
  );

  async function triggerDailyCycle() {
    await apiClient.post('/api/agent/trigger', { cycleType: 'daily' });
    await mutate();
  }

  async function pauseRun(runId: string) {
    await apiClient.post(`/api/agent/runs/${runId}/pause`);
    await mutate();
  }

  async function resumeRun(runId: string) {
    await apiClient.post(`/api/agent/runs/${runId}/resume`);
    await mutate();
  }

  async function cancelRun(runId: string) {
    await apiClient.post(`/api/agent/runs/${runId}/cancel`);
    await mutate();
  }

  async function retryStep(stepId: string) {
    await apiClient.post(`/api/agent/steps/${stepId}/retry`);
    await mutate();
  }

  const isActiveRun = ['RUNNING', 'RETRYING', 'QUEUED', 'WAITING'].includes(data?.state ?? '');

  return {
    status: data,
    error,
    isLoading,
    isActiveRun,
    triggerDailyCycle,
    pauseRun,
    resumeRun,
    cancelRun,
    retryStep,
    refresh: mutate,
  };
}

