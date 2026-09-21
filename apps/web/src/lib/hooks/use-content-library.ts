'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

export interface ContentListItem {
  id: string;
  pillar: string;
  format: string;
  concept: string;
  hook: string;
  caption: string;
  hashtags: string[];
  status: string;
  assetGenerationStatus: string;
  needsAttention: boolean;
  needsAttentionReason?: string;
  strategyVersionId: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  primaryAsset?: {
    id: string;
    assetType: string;
    storageUrl: string;
    generationStatus: string;
  };
  latestPrompt?: {
    id: string;
    promptText: string;
    promptVersion: number;
    assetType: string;
    source: string;
  };
}

export interface ContentLibraryFilters {
  status?: string;
  assetStatus?: string;
  search?: string;
  strategyVersionId?: string;
  page?: number;
  limit?: number;
}

const fetcherRaw = (url: string) => apiClient.getRaw<any>(url);

export function useContentLibrary(filters: ContentLibraryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.assetStatus) params.set('assetStatus', filters.assetStatus);
  if (filters.search) params.set('search', filters.search);
  if (filters.strategyVersionId) params.set('strategyVersionId', filters.strategyVersionId);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const queryString = params.toString();
  const url = `/api/content/ideas${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcherRaw, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  return {
    items: ((data as any)?.data ?? []) as ContentListItem[],
    total: (data as any)?.total ?? 0,
    page: (data as any)?.page ?? 1,
    error,
    isLoading,
    refresh: mutate,
  };
}

export function useNeedsAttention() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/content/ideas?assetStatus=failed&limit=10',
    fetcherRaw,
    { revalidateOnFocus: true }
  );

  return {
    items: ((data as any)?.data ?? []) as ContentListItem[],
    count: (data as any)?.total ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}
