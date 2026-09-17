'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

const fetcher = (url: string) => apiClient.get<any>(url);

export function useNeedsAttentionCount() {
  const { data } = useSWR('/api/content/needs-attention', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const count = data?.count ?? 0;

  return { count };
}
