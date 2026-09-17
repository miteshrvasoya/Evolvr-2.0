'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

export interface UngeneratedPrompt {
  id: string;
  assetType: string;
  promptText: string;
  promptVersion: number;
  source: 'ai_generated' | 'user_edited' | 'improved';
  provider?: string;
  model?: string;
  createdAt: string;
}

export interface UngeneratedIdea {
  id: string;
  pillar: string;
  format: string;
  concept: string;
  hook?: string;
  caption?: string;
  status: string;
  assetGenerationStatus: string;
  needsAttention: boolean;
  needsAttentionReason?: string;
  strategyVersionId: string;
  createdAt: string;
  prompts: UngeneratedPrompt[];
  lastFailure?: {
    errorCategory: string;
    errorMessage: string;
    attemptNumber: number;
  };
}

export interface AgentRunGroup {
  run: {
    id: string;
    runType: string;
    status: string;
    startedAt: string | null;
    completedAt?: string;
    strategyVersionId: string;
    strategyVersionNumber?: number;
  };
  ideas: UngeneratedIdea[];
}

const fetcher = (url: string) => apiClient.get<any>(url);

export function useUngeneratedPrompts() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/content/ungenerated-prompts',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 }
  );

  return {
    groups: (data?.data ?? []) as AgentRunGroup[],
    totalIdeas: data?.totalIdeas ?? 0,
    totalPrompts: data?.totalPrompts ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}
