'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

const fetcher = (path: string) => apiClient.get<any[]>(path);

export function useContentDrafts() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/content/drafts',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  async function approveIdea(ideaId: string, scheduledAt?: string) {
    await apiClient.post(`/api/content/ideas/${ideaId}/approve`, { scheduledAt });
    await mutate();
  }

  async function updateIdea(ideaId: string, data: { caption?: string, hook?: string }) {
    await apiClient.patch(`/api/content/ideas/${ideaId}`, data);
    await mutate();
  }

  async function uploadAsset(ideaId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    // We cannot use the default apiClient if it sets application/json, 
    // so we use a raw fetch or rely on apiClient handling FormData if it does.
    // Assuming apiClient.post supports FormData:
    await fetch(`/api/content/ideas/${ideaId}/asset`, {
      method: 'POST',
      body: formData,
    });
    await mutate();
  }

  return {
    data,
    error,
    isLoading,
    approveIdea,
    updateIdea,
    uploadAsset,
    refresh: mutate,
  };
}
