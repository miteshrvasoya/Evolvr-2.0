'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

export interface ContentAsset {
  id: string;
  assetType: string;
  storageUrl: string;
  mimeType: string;
  prompt: string;
  generationStatus: string;
  source: string;
  generationAttemptId?: string;
  attemptNumber?: number;
  attemptStatus?: string;
  errorCategory?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ContentPrompt {
  id: string;
  contentIdeaId: string;
  assetType: string;
  promptText: string;
  promptVersion: number;
  provider?: string;
  model?: string;
  source: 'ai_generated' | 'user_edited' | 'improved';
  originalPromptId?: string;
  createdAt: string;
}

export interface GenerationAttempt {
  id: string;
  contentIdeaId: string;
  contentAssetPromptId?: string;
  assetType: string;
  provider?: string;
  model?: string;
  status: string;
  errorCategory?: string;
  errorMessage?: string;
  attemptNumber: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  assetId?: string;
  idempotencyKey?: string;
  promptText?: string;
  promptVersion?: number;
  promptSource?: string;
  createdAt: string;
}

export interface ContentVersion {
  id: string;
  contentIdeaId: string;
  versionNumber: number;
  hook?: string;
  caption?: string;
  concept?: string;
  pillar?: string;
  format?: string;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

export interface ContentDetail {
  id: string;
  pillar: string;
  format: string;
  concept: string;
  hook: string;
  caption: string;
  hashtags: string[];
  altText?: string;
  status: string;
  assetGenerationStatus: string;
  needsAttention: boolean;
  needsAttentionReason?: string;
  strategyVersionId: string;
  strategyVersionNumber?: number;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  assets: ContentAsset[];
  prompts: ContentPrompt[];
  versions: ContentVersion[];
}

const fetcher = (url: string) => apiClient.get<any>(url);

export function useContentDetail(ideaId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    ideaId ? `/api/content/ideas/${ideaId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    content: data?.data as ContentDetail | undefined,
    error,
    isLoading,
    refresh: mutate,
  };
}

export function useGenerationHistory(ideaId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    ideaId ? `/api/content/ideas/${ideaId}/generation-history` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    attempts: (data?.data ?? []) as GenerationAttempt[],
    error,
    isLoading,
    refresh: mutate,
  };
}
