'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

const fetcher = (path: string) => apiClient.get<any[]>(path);

export function useContentDrafts() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/content/drafts',
    fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
